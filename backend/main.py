"""Stick API — FastAPI application with WebSocket streaming."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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
from backend.db import get_session, init_db
from backend.discovery.discovery_pipeline import run_discovery
from backend.enrichment.pipeline import enrich_lead, enrich_leads
from backend.models import (
    CompanyProfile,
    EnrichmentStatus,
    GeneratedEmail,
    Lead,
    PitchDeck,
    Product,
    ProductMatch,
    User,
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


# ─── Discovery ───────────────────────────────────────────────────────


@app.post("/api/discovery/run")
async def run_discovery_endpoint(body: DiscoveryRequest, user: User = Depends(get_current_user)):
    """Kick off ICP-based company discovery. Fire-and-forget async pipeline."""
    asyncio.create_task(run_discovery(body.product_ids, body.max_companies, manager, user.id))
    return {
        "status": "discovery_started",
        "max_companies": body.max_companies,
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
async def list_leads(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    result = await session.execute(select(Lead).where(Lead.user_id == user.id))
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
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.enrichment_status == EnrichmentStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Enrichment already in progress")

    # Reset status
    lead.enrichment_status = EnrichmentStatus.PENDING
    session.add(lead)
    await session.commit()

    # Fire-and-forget
    asyncio.create_task(enrich_lead(lead_id, manager))
    return {"lead_id": lead_id, "status": "enrichment_started"}


# ─── Product Matching ─────────────────────────────────────────────────


@app.post("/api/matches/generate")
async def trigger_matching(user: User = Depends(get_current_user)):
    """Generate matches for all enriched leads against all products. Fire-and-forget."""
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


# ─── Analytics ────────────────────────────────────────────────────────


@app.get("/api/analytics")
async def get_analytics_endpoint(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    """Get analytics dashboard data."""
    from backend.analytics import get_analytics

    return await get_analytics(session, user.id)


@app.post("/api/analytics/predict")
async def trigger_predictions(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    """Predict conversion likelihood for matches missing predictions."""
    from backend.analytics import predict_conversions

    asyncio.create_task(predict_conversions(manager, session, user.id))
    return {"status": "prediction_started"}
