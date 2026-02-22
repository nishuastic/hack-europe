"""Stick API — FastAPI application with WebSocket streaming."""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.billing import (
    CREDIT_COSTS,
    PAYG_PACKS,
    TIER_PLANS,
    check_credits,
    create_payg_checkout,
    create_tier_checkout,
    deduct_credits,
    ensure_customer,
    handle_stripe_webhook,
)
from backend.config import settings  # noqa: F401 — used in refresh endpoint
from backend.db import get_session, init_db
from backend.discovery.discovery_pipeline import run_discovery
from backend.enrichment.pipeline import enrich_lead, enrich_leads
from backend.models import (
    CompanyProfile,
    EnrichmentStatus,
    GeneratedEmail,
    GenerationRun,
    Lead,
    LinkedInConnection,
    LinkedInMatch,
    PitchDeck,
    Product,
    ProductMatch,
    UsageEvent,
    UsageEventType,
    User,
    UserCredits,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─── WebSocket Manager ───────────────────────────────────────────────


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, data: dict):
        message = json.dumps(data)
        for ws in self.active.copy():
            try:
                await ws.send_text(message)
            except Exception:
                self.active.remove(ws)


manager = ConnectionManager()


# ─── App Lifespan ─────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized")
    yield


app = FastAPI(title="Stick API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── WebSocket Endpoint ──────────────────────────────────────────────


@app.websocket("/ws/updates")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ─── Auth Schemas & Routes ────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@app.post("/api/auth/register")
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password), name=body.name)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    assert user.id is not None
    # Initialize free credits
    user_credits = UserCredits(user_id=user.id, credits_remaining=100)
    session.add(user_credits)
    await session.commit()
    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name},
    }


@app.post("/api/auth/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    assert user.id is not None
    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name},
    }


@app.post("/api/auth/refresh")
async def refresh_token(body: RefreshTokenRequest, session: AsyncSession = Depends(get_session)):
    from jose import jwt

    try:
        payload = jwt.decode(body.refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    assert user.id is not None
    access = create_access_token(user.id, user.email)
    return {"access_token": access, "token_type": "bearer"}


@app.get("/api/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name}


# ─── Request/Response Schemas ─────────────────────────────────────────


class ProductCreate(BaseModel):
    name: str
    description: str
    features: list[str] | None = None
    industry_focus: str | None = None
    pricing_model: str | None = None
    company_size_target: str | None = None
    geography: str | None = None
    stage: str | None = None
    company_name: str | None = None
    website: str | None = None
    example_clients: list[str] | None = None
    differentiator: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    features: list[str] | None = None
    industry_focus: str | None = None
    pricing_model: str | None = None
    company_size_target: str | None = None
    geography: str | None = None
    stage: str | None = None
    company_name: str | None = None
    website: str | None = None
    example_clients: list[str] | None = None
    differentiator: str | None = None


class BulkProductImport(BaseModel):
    products: list[ProductCreate]


class LeadImport(BaseModel):
    companies: list[str]


class CompanyProfileUpdate(BaseModel):
    company_name: str | None = None
    website: str | None = None
    growth_stage: str | None = None
    geography: str | None = None
    value_proposition: str | None = None


class DiscoveryRequest(BaseModel):
    product_ids: list[int] | None = None
    max_companies: int = 20


# ─── Product CRUD ─────────────────────────────────────────────────────


@app.post("/api/products")
async def import_products(
    body: BulkProductImport, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    created = []
    for p in body.products:
        product = Product(**p.model_dump(), user_id=user.id)
        session.add(product)
        await session.commit()
        await session.refresh(product)
        created.append(product)
    return {"products": created}


@app.get("/api/products")
async def list_products(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(Product).where(Product.user_id == user.id))
    return {"products": result.scalars().all()}


@app.get("/api/products/{product_id}")
async def get_product(
    product_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/api/products/{product_id}")
async def update_product(
    product_id: int,
    body: ProductUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product


@app.delete("/api/products/{product_id}")
async def delete_product(
    product_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await session.delete(product)
    await session.commit()
    return {"deleted": True}


# ─── Company Profile ──────────────────────────────────────────────────


@app.get("/api/company-profile")
async def get_company_profile(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    return profile or {}


@app.put("/api/company-profile")
async def upsert_company_profile(
    body: CompanyProfileUpdate, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    result = await session.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
    else:
        profile = CompanyProfile(**body.model_dump(), user_id=user.id)
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


# ─── Generation Runs ─────────────────────────────────────────────────


@app.get("/api/generation-runs")
async def list_generation_runs(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all generation runs for the current user."""
    result = await session.execute(
        select(GenerationRun).where(GenerationRun.user_id == user.id).order_by(GenerationRun.created_at.desc())  # type: ignore[attr-defined]
    )
    return {"runs": result.scalars().all()}


@app.get("/api/generation-runs/{run_id}")
async def get_generation_run(
    run_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get a single generation run."""
    run = (
        await session.execute(select(GenerationRun).where(GenerationRun.id == run_id, GenerationRun.user_id == user.id))
    ).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Generation run not found")
    return run


# ─── Discovery ───────────────────────────────────────────────────────


@app.post("/api/discovery/run")
async def run_discovery_endpoint(
    body: DiscoveryRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Kick off ICP-based company discovery. Creates a GenerationRun, then fire-and-forget."""
    assert user.id is not None

    # Resolve product names for the run snapshot
    result = await session.execute(select(Product).where(Product.user_id == user.id))
    all_products = list(result.scalars().all())

    if body.product_ids:
        pid_set = set(body.product_ids)
        selected = [p for p in all_products if p.id in pid_set]
    else:
        selected = all_products

    if not selected:
        raise HTTPException(status_code=400, detail="No products found")

    # Capture full product data as snapshots
    snapshots = []
    for p in selected:
        snapshots.append(
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "features": p.features,
                "industry_focus": p.industry_focus,
                "pricing_model": p.pricing_model,
                "company_size_target": p.company_size_target,
                "geography": p.geography,
                "stage": p.stage,
                "company_name": p.company_name,
                "website": p.website,
                "example_clients": p.example_clients,
                "differentiator": p.differentiator,
            }
        )

    run = GenerationRun(
        user_id=user.id,
        status="running",
        product_ids=[p.id for p in selected],
        product_names=[p.name for p in selected],
        product_snapshots=snapshots,
        max_companies=body.max_companies,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    asyncio.create_task(run_discovery(body.product_ids, body.max_companies, manager, user.id, generation_run_id=run.id))
    return {
        "status": "discovery_started",
        "max_companies": body.max_companies,
        "generation_run_id": run.id,
    }


# ─── Lead Import + List ───────────────────────────────────────────────


@app.post("/api/leads/import")
async def import_leads(
    body: LeadImport, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    lead_ids: list[int] = []
    for company in body.companies:
        lead = Lead(company_name=company, enrichment_status=EnrichmentStatus.PENDING, user_id=user.id)
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        assert lead.id is not None
        lead_ids.append(lead.id)

    # Fire-and-forget enrichment
    asyncio.create_task(enrich_leads(lead_ids, manager))

    return {"leads_created": len(lead_ids), "lead_ids": lead_ids, "status": "enrichment_started"}


@app.get("/api/leads")
async def list_leads(
    generation_run_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = select(Lead).where(Lead.user_id == user.id)
    if generation_run_id is not None:
        query = query.where(Lead.generation_run_id == generation_run_id)
    result = await session.execute(query)
    return {"leads": result.scalars().all()}


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@app.post("/api/leads/{lead_id}/enrich")
async def trigger_enrich(
    lead_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)
):
    """Re-trigger enrichment for a single lead."""
    assert user.id is not None
    if not await check_credits(user.id, UsageEventType.ENRICHMENT, session):
        raise HTTPException(status_code=402, detail="Insufficient credits for enrichment")

    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.enrichment_status == EnrichmentStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Enrichment already in progress")

    await deduct_credits(user.id, UsageEventType.ENRICHMENT, session, {"lead_id": lead_id})

    # Reset status
    lead.enrichment_status = EnrichmentStatus.PENDING
    session.add(lead)
    await session.commit()

    # Fire-and-forget
    asyncio.create_task(enrich_lead(lead_id, manager))
    return {"lead_id": lead_id, "status": "enrichment_started"}


# ─── Product Matching ─────────────────────────────────────────────────


@app.post("/api/matches/generate")
async def trigger_matching(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate matches for all enriched leads against all products. Fire-and-forget."""
    assert user.id is not None
    if not await check_credits(user.id, UsageEventType.MATCHING, session):
        raise HTTPException(status_code=402, detail="Insufficient credits for matching")

    await deduct_credits(user.id, UsageEventType.MATCHING, session)

    from backend.matching.pipeline import generate_all_matches

    asyncio.create_task(generate_all_matches(manager, user.id))
    return {"status": "matching_started"}


@app.get("/api/matches")
async def list_matches(
    lead_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List matches with optional lead_id and product_id filters."""
    query = select(ProductMatch).join(Lead).where(Lead.user_id == user.id)
    if lead_id is not None:
        query = query.where(ProductMatch.lead_id == lead_id)
    if product_id is not None:
        query = query.where(ProductMatch.product_id == product_id)
    query = query.order_by(ProductMatch.match_score.desc())  # type: ignore[attr-defined]
    result = await session.execute(query)
    return {"matches": result.scalars().all()}


# ─── Pitch Deck ───────────────────────────────────────────────────────


@app.post("/api/leads/{lead_id}/pitch-deck")
async def create_pitch_deck(
    lead_id: int,
    product_id: int = Query(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate a pitch deck for a lead-product pair. Awaited (not fire-and-forget)."""
    assert user.id is not None
    if not await check_credits(user.id, UsageEventType.PITCH_DECK, session):
        raise HTTPException(status_code=402, detail="Insufficient credits for pitch deck generation")

    from backend.actions.pitch_deck import generate_pitch_deck

    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get match reasoning if available
    match_obj = (
        await session.execute(
            select(ProductMatch)
            .join(Lead)
            .where(
                ProductMatch.lead_id == lead_id,
                ProductMatch.product_id == product_id,
                Lead.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    reasoning = match_obj.match_reasoning if match_obj else "No prior match — generate general pitch."

    result = await generate_pitch_deck(lead, product, reasoning)
    await deduct_credits(user.id, UsageEventType.PITCH_DECK, session, {"lead_id": lead_id, "product_id": product_id})

    # Save to DB
    deck = PitchDeck(
        lead_id=lead_id,
        product_id=product_id,
        slides=result["slides"],
        pptx_path=result["pptx_path"],
    )
    session.add(deck)
    lead.pitch_deck_generated = True
    session.add(lead)
    await session.commit()
    await session.refresh(deck)

    return {"pitch_deck_id": deck.id, "slides": result["slides"], "pptx_path": result["pptx_path"]}


@app.get("/api/leads/{lead_id}/pitch-deck")
async def get_pitch_deck(
    lead_id: int,
    product_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get existing pitch deck for a lead (optionally filtered by product)."""
    query = select(PitchDeck).join(Lead).where(PitchDeck.lead_id == lead_id, Lead.user_id == user.id)
    if product_id is not None:
        query = query.where(PitchDeck.product_id == product_id)
    query = query.order_by(PitchDeck.created_at.desc())  # type: ignore[attr-defined]
    deck = (await session.execute(query)).scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch deck not found")
    return deck


@app.get("/api/leads/{lead_id}/pitch-deck/download")
async def download_pitch_deck(
    lead_id: int,
    product_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Download the PPTX file for a pitch deck."""
    query = select(PitchDeck).join(Lead).where(PitchDeck.lead_id == lead_id, Lead.user_id == user.id)
    if product_id is not None:
        query = query.where(PitchDeck.product_id == product_id)
    query = query.order_by(PitchDeck.created_at.desc())  # type: ignore[attr-defined]
    deck = (await session.execute(query)).scalar_one_or_none()
    if not deck or not deck.pptx_path:
        raise HTTPException(status_code=404, detail="Pitch deck PPTX not found")
    if not os.path.exists(deck.pptx_path):
        raise HTTPException(status_code=404, detail="PPTX file missing from disk")
    return FileResponse(
        deck.pptx_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"pitch_{lead_id}_{deck.product_id}.pptx",
    )


# ─── Email Generator ─────────────────────────────────────────────────


@app.post("/api/leads/{lead_id}/email")
async def create_email(
    lead_id: int,
    product_id: int = Query(...),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Generate an outreach email for a lead-product pair."""
    assert user.id is not None
    if not await check_credits(user.id, UsageEventType.EMAIL, session):
        raise HTTPException(status_code=402, detail="Insufficient credits for email generation")

    from backend.actions.email_generator import generate_email

    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get match reasoning
    match_obj = (
        await session.execute(
            select(ProductMatch)
            .join(Lead)
            .where(
                ProductMatch.lead_id == lead_id,
                ProductMatch.product_id == product_id,
                Lead.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    reasoning = match_obj.match_reasoning if match_obj else ""

    result = await generate_email(lead, product, reasoning)
    await deduct_credits(user.id, UsageEventType.EMAIL, session, {"lead_id": lead_id, "product_id": product_id})

    # Save to DB
    email_record = GeneratedEmail(
        lead_id=lead_id,
        product_id=product_id,
        contact_name=result["contact_name"],
        contact_role=result["contact_role"],
        subject=result["subject"],
        body=result["body"],
    )
    session.add(email_record)
    lead.email_generated = True
    session.add(lead)
    await session.commit()
    await session.refresh(email_record)

    return email_record


# ─── LinkedIn Import ──────────────────────────────────────────────────


@app.post("/api/linkedin/import")
async def import_linkedin(
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Upload a LinkedIn data export (ZIP or CSV) and start the import pipeline."""
    from backend.db import async_session as session_factory
    from backend.linkedin.csv_parser import parse_connections_csv, parse_linkedin_zip
    from backend.linkedin.pipeline import process_linkedin_import

    assert user.id is not None
    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".zip"):
        connections = parse_linkedin_zip(content)
    elif filename.endswith(".csv"):
        connections = parse_connections_csv(content.decode("utf-8-sig"))
    else:
        raise HTTPException(status_code=400, detail="File must be .zip or .csv")

    if not connections:
        raise HTTPException(status_code=400, detail="No connections found in file")

    asyncio.create_task(process_linkedin_import(user.id, connections, manager, session_factory))
    return {"status": "import_started", "connections_found": len(connections)}


@app.post("/api/linkedin/demo")
async def import_linkedin_demo(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Import mock LinkedIn data for demo purposes."""
    from backend.db import async_session as session_factory
    from backend.linkedin.csv_parser import parse_connections_csv
    from backend.linkedin.mock_data import generate_mock_csv_text
    from backend.linkedin.pipeline import process_linkedin_import

    assert user.id is not None
    csv_text = generate_mock_csv_text()
    connections = parse_connections_csv(csv_text)
    asyncio.create_task(process_linkedin_import(user.id, connections, manager, session_factory))
    return {"status": "demo_import_started", "connections_found": len(connections)}


@app.get("/api/linkedin/connections")
async def list_linkedin_connections(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all imported LinkedIn connections."""
    result = await session.execute(
        select(LinkedInConnection).where(LinkedInConnection.user_id == user.id)
    )
    return {"connections": result.scalars().all()}


@app.get("/api/linkedin/matches")
async def list_linkedin_matches(
    lead_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List LinkedIn matches with outreach plans."""
    query = select(LinkedInMatch).where(LinkedInMatch.user_id == user.id)
    if lead_id is not None:
        query = query.where(LinkedInMatch.lead_id == lead_id)
    result = await session.execute(query)
    matches = result.scalars().all()

    # Enrich with connection and lead info
    enriched = []
    for m in matches:
        conn = (await session.execute(
            select(LinkedInConnection).where(LinkedInConnection.id == m.connection_id)
        )).scalar_one_or_none()
        lead = (await session.execute(
            select(Lead).where(Lead.id == m.lead_id)
        )).scalar_one_or_none()

        enriched.append({
            "id": m.id,
            "connection_id": m.connection_id,
            "lead_id": m.lead_id,
            "match_confidence": m.match_confidence,
            "status": m.status,
            "outreach_plan": m.outreach_plan,
            "connection_name": f"{conn.first_name} {conn.last_name}" if conn else "Unknown",
            "connection_position": conn.position if conn else None,
            "connection_company": conn.company if conn else None,
            "lead_company_name": lead.company_name if lead else "Unknown",
        })

    return {"matches": enriched}


@app.delete("/api/linkedin/connections")
async def clear_linkedin_connections(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Clear all LinkedIn connections and matches for the current user."""
    # Delete matches first (foreign key)
    matches = (await session.execute(
        select(LinkedInMatch).where(LinkedInMatch.user_id == user.id)
    )).scalars().all()
    for m in matches:
        await session.delete(m)

    connections = (await session.execute(
        select(LinkedInConnection).where(LinkedInConnection.user_id == user.id)
    )).scalars().all()
    for c in connections:
        await session.delete(c)

    await session.commit()
    return {"deleted": True, "connections_removed": len(connections), "matches_removed": len(matches)}


# ─── Analytics ────────────────────────────────────────────────────────


@app.get("/api/analytics")
async def get_analytics_endpoint(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    """Get analytics dashboard data."""
    from backend.analytics import get_analytics

    assert user.id is not None
    return await get_analytics(session, user.id)


@app.post("/api/analytics/predict")
async def trigger_predictions(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    """Predict conversion likelihood for matches missing predictions."""
    from backend.analytics import predict_conversions

    assert user.id is not None
    asyncio.create_task(predict_conversions(manager, session, user.id))
    return {"status": "prediction_started"}


# ─── Billing ─────────────────────────────────────────────────────────


class TierCheckoutRequest(BaseModel):
    tier: str  # "starter", "growth", "scale"


class PaygCheckoutRequest(BaseModel):
    pack: str  # "100", "500", "2000", "5000"


@app.get("/api/billing/credits")
async def get_credits(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get current user's credit balance + available plans and packs."""
    assert user.id is not None
    credits = await ensure_customer(user.id, user.email, session)
    return {
        "currency": "stick_credits",
        "credits_remaining": credits.credits_remaining,
        "costs": {k.value: v for k, v in CREDIT_COSTS.items()},
        "tiers": TIER_PLANS,
        "payg_packs": PAYG_PACKS,
    }


@app.post("/api/billing/subscribe")
async def subscribe_tier(
    body: TierCheckoutRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for a monthly tier subscription."""
    assert user.id is not None
    await ensure_customer(user.id, user.email, session)
    url = await create_tier_checkout(user.id, body.tier, session)
    return {"checkout_url": url}


@app.post("/api/billing/buy-credits")
async def buy_credits(
    body: PaygCheckoutRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Create a Stripe Checkout session for a one-time credit pack purchase."""
    assert user.id is not None
    await ensure_customer(user.id, user.email, session)
    url = await create_payg_checkout(user.id, body.pack, session)
    return {"checkout_url": url}


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    """Handle Stripe webhook events (adds credits on successful payment)."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        result = await handle_stripe_webhook(payload, sig, session)
        return result
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")


@app.get("/api/billing/usage")
async def get_usage(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get usage history for current user."""
    assert user.id is not None
    result = await session.execute(
        select(UsageEvent).where(UsageEvent.user_id == user.id).order_by(UsageEvent.created_at.desc())  # type: ignore[attr-defined]
    )
    events = result.scalars().all()
    return {
        "usage": [
            {"event_type": e.event_type, "credits_used": e.credits_used, "created_at": str(e.created_at)}
            for e in events
        ]
    }
