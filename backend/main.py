"""Stick API — FastAPI application with WebSocket streaming."""

import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.api_keys import create_task_with_context, set_user_keys
from backend.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.billing import HOURS_SAVED, SDR_HOURLY_RATE
from backend.config import settings  # noqa: F401 — used in refresh endpoint
from backend.db import get_session, init_db
from backend.discovery.discovery_pipeline import run_discovery
from backend.enrichment.pipeline import enrich_lead, enrich_leads
from backend.models import (
    CompanyProfile,
    EnrichmentStatus,
    GeneratedEmail,
    GenerationRun,
    ICPProfile,
    Lead,
    LinkedInConnection,
    LinkedInMatch,
    PitchDeck,
    Product,
    ProductMatch,
    UsageEvent,
    UsageEventType,
    User,
    UserApiKeys,
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
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
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


# ─── BYOK: load user API keys into contextvars per request ────────────


async def _load_user_api_keys(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency — sets contextvars with the authenticated user's API keys."""
    from backend.encryption import decrypt

    assert user.id is not None
    row = (await session.execute(select(UserApiKeys).where(UserApiKeys.user_id == user.id))).scalar_one_or_none()
    anthropic_key = decrypt(row.encrypted_anthropic_key) if row and row.encrypted_anthropic_key else None
    linkup_key = decrypt(row.encrypted_linkup_key) if row and row.encrypted_linkup_key else None
    set_user_keys(anthropic_key, linkup_key)
    return user


# ─── BYOK: API key management endpoints ──────────────────────────────


class SaveApiKeysRequest(BaseModel):
    anthropic_api_key: str | None = None
    linkup_api_key: str | None = None


@app.put("/api/settings/api-keys")
async def save_api_keys(
    body: SaveApiKeysRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Save (encrypted) user-provided API keys."""
    from backend.encryption import encrypt

    assert user.id is not None
    row = (await session.execute(select(UserApiKeys).where(UserApiKeys.user_id == user.id))).scalar_one_or_none()
    if row is None:
        row = UserApiKeys(user_id=user.id)
        session.add(row)
    if body.anthropic_api_key is not None:
        row.encrypted_anthropic_key = encrypt(body.anthropic_api_key) if body.anthropic_api_key else None
    if body.linkup_api_key is not None:
        row.encrypted_linkup_key = encrypt(body.linkup_api_key) if body.linkup_api_key else None
    await session.commit()
    return {"status": "saved"}


@app.get("/api/settings/api-keys")
async def get_api_keys(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return masked API keys (last 4 chars only)."""
    from backend.encryption import decrypt

    assert user.id is not None
    row = (await session.execute(select(UserApiKeys).where(UserApiKeys.user_id == user.id))).scalar_one_or_none()

    def _mask(encrypted: str | None) -> str | None:
        if not encrypted:
            return None
        plain = decrypt(encrypted)
        return f"{'*' * max(0, len(plain) - 4)}{plain[-4:]}" if len(plain) > 4 else "****"

    return {
        "anthropic_api_key": _mask(row.encrypted_anthropic_key) if row else None,
        "linkup_api_key": _mask(row.encrypted_linkup_key) if row else None,
    }


@app.delete("/api/settings/api-keys")
async def delete_api_keys(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove all stored API keys for the current user."""
    assert user.id is not None
    row = (await session.execute(select(UserApiKeys).where(UserApiKeys.user_id == user.id))).scalar_one_or_none()
    if row:
        await session.delete(row)
        await session.commit()
    return {"status": "deleted"}


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
    current_clients: list[dict] | None = None
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
    current_clients: list[dict] | None = None
    differentiator: str | None = None


class BulkProductImport(BaseModel):
    products: list[ProductCreate]


class LeadImport(BaseModel):
    companies: list[str]
    generation_run_id: int | None = None


class CompanyProfileUpdate(BaseModel):
    company_name: str | None = None
    website: str | None = None
    growth_stage: str | None = None
    geography: str | None = None
    value_proposition: str | None = None


class DiscoveryRequest(BaseModel):
    product_ids: list[int] | None = None
    max_companies: int = 20


class AutofillURLRequest(BaseModel):
    url: str


# ─── Autofill (LinkUp structured extraction) ────────────────────────


PRODUCT_AUTOFILL_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "Product or service name"},
        "description": {"type": "string", "description": "One-paragraph product description"},
        "features": {"type": "array", "items": {"type": "string"}, "description": "Key features list"},
        "industry_focus": {"type": "string", "description": "Target industry"},
        "pricing_model": {
            "type": "string",
            "description": "Pricing model (SaaS, project-based, retainer, usage-based, license)",
        },
        "company_size_target": {"type": "string", "description": "Target company size (SMB, mid-market, enterprise)"},
        "geography": {"type": "string", "description": "Target geography"},
        "stage": {"type": "string", "description": "Target customer stage (startup, scaling, enterprise)"},
        "company_name": {"type": "string", "description": "Company that makes this product"},
        "website": {"type": "string", "description": "Product or company website URL"},
        "example_clients": {"type": "array", "items": {"type": "string"}, "description": "Known clients or customers"},
        "differentiator": {"type": "string", "description": "Main competitive differentiator"},
    },
    "required": [],
}

COMPANY_AUTOFILL_SCHEMA = {
    "type": "object",
    "properties": {
        "company_name": {"type": "string", "description": "Company name"},
        "website": {"type": "string", "description": "Company website URL"},
        "growth_stage": {"type": "string", "description": "Growth stage (Pre-Seed, Seed, Series A, Series B+, Public)"},
        "geography": {"type": "string", "description": "Company HQ location"},
        "value_proposition": {"type": "string", "description": "What the company does in one paragraph"},
    },
    "required": [],
}


def _clean_autofill(data: dict) -> dict:
    """Replace empty strings with None so frontend can skip them."""
    return {k: (v if v != "" else None) for k, v in data.items()}


@app.post("/api/autofill/product")
async def autofill_product(
    body: AutofillURLRequest,
    user: User = Depends(_load_user_api_keys),
):
    """Extract product details from a URL using LinkUp structured search."""
    from backend.enrichment.linkup_search import _get_client

    client = _get_client()
    try:
        response = await client.async_search(
            query=f"Extract product/service details from this page: {body.url}",
            depth="standard",
            output_type="structured",
            structured_output_schema=json.dumps(PRODUCT_AUTOFILL_SCHEMA),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LinkUp search failed: {e}")
    raw = response.output if hasattr(response, "output") else response
    data = json.loads(raw) if isinstance(raw, str) else raw
    return _clean_autofill(data)


@app.post("/api/autofill/company-profile")
async def autofill_company_profile(
    body: AutofillURLRequest,
    user: User = Depends(_load_user_api_keys),
):
    """Extract company profile details from a URL using LinkUp structured search."""
    from backend.enrichment.linkup_search import _get_client

    client = _get_client()
    try:
        response = await client.async_search(
            query=f"Extract company information from this page: {body.url}",
            depth="standard",
            output_type="structured",
            structured_output_schema=json.dumps(COMPANY_AUTOFILL_SCHEMA),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LinkUp search failed: {e}")
    raw = response.output if hasattr(response, "output") else response
    data = json.loads(raw) if isinstance(raw, str) else raw
    return _clean_autofill(data)


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


# ─── ICP Learning ────────────────────────────────────────────────────


@app.post("/api/products/{product_id}/learn-icp")
async def learn_icp(
    product_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(_load_user_api_keys),
):
    """Trigger ICP learning for a product based on its current_clients."""
    assert user.id is not None
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.current_clients or len(product.current_clients) == 0:
        raise HTTPException(status_code=400, detail="Product has no current_clients to learn from")

    from backend.icp.icp_pipeline import run_icp_learning

    create_task_with_context(run_icp_learning(product_id, manager))
    return {
        "status": "icp_learning_started",
        "product_id": product_id,
        "customers_to_research": len(product.current_clients),
    }


class ICPProfileUpdate(BaseModel):
    icp_summary: Optional[str] = None
    target_industries: Optional[list[str]] = None
    geographies: Optional[list[str]] = None
    funding_stages: Optional[list[str]] = None
    revenue_range: Optional[str] = None
    employee_range_min: Optional[int] = None
    employee_range_max: Optional[int] = None
    common_traits: Optional[list[str]] = None
    anti_patterns: Optional[list[str]] = None


@app.patch("/api/products/{product_id}/icp")
async def update_icp_profile(
    product_id: int,
    body: ICPProfileUpdate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Manually update fields of the ICP profile for a product."""
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    icp = (await session.execute(select(ICPProfile).where(ICPProfile.product_id == product_id))).scalar_one_or_none()
    if not icp:
        raise HTTPException(status_code=404, detail="ICP profile not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(icp, field, value)

    session.add(icp)
    await session.commit()
    await session.refresh(icp)
    return icp


@app.get("/api/products/{product_id}/icp")
async def get_icp_profile(
    product_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get the ICP profile for a product."""
    # Verify product belongs to user
    product = (
        await session.execute(select(Product).where(Product.id == product_id, Product.user_id == user.id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    icp = (await session.execute(select(ICPProfile).where(ICPProfile.product_id == product_id))).scalar_one_or_none()
    if not icp:
        return {"status": "no_icp"}
    return icp


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
    user: User = Depends(_load_user_api_keys),
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

    create_task_with_context(
        run_discovery(body.product_ids, body.max_companies, manager, user.id, generation_run_id=run.id)
    )
    return {
        "status": "discovery_started",
        "max_companies": body.max_companies,
        "generation_run_id": run.id,
    }


@app.post("/api/discovery/run/{run_id}/more")
async def discover_more_for_run(
    run_id: int,
    body: DiscoveryRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(_load_user_api_keys),
):
    """Append more discovered companies to an existing GenerationRun."""
    assert user.id is not None

    run = await session.get(GenerationRun, run_id)
    if run is None or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    # Mark the run as running again
    run.status = "running"
    session.add(run)
    await session.commit()

    # Use run's original product_ids so discovery stays consistent
    product_ids = run.product_ids or None
    create_task_with_context(run_discovery(product_ids, body.max_companies, manager, user.id, generation_run_id=run_id))
    return {
        "status": "discovery_started",
        "max_companies": body.max_companies,
        "generation_run_id": run_id,
    }


# ─── Lead Import + List ───────────────────────────────────────────────


@app.post("/api/leads/import")
async def import_leads(
    body: LeadImport, session: AsyncSession = Depends(get_session), user: User = Depends(_load_user_api_keys)
):
    lead_ids: list[int] = []
    for company in body.companies:
        lead = Lead(
            company_name=company,
            enrichment_status=EnrichmentStatus.PENDING,
            user_id=user.id,
            generation_run_id=body.generation_run_id,
        )
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        assert lead.id is not None
        lead_ids.append(lead.id)

    # Bump lead_count on the run if provided
    if body.generation_run_id is not None:
        run = await session.get(GenerationRun, body.generation_run_id)
        if run is not None and run.user_id == user.id:
            run.lead_count = (run.lead_count or 0) + len(lead_ids)
            session.add(run)
            await session.commit()

    # Fire-and-forget enrichment
    create_task_with_context(enrich_leads(lead_ids, manager))

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
    lead_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(_load_user_api_keys)
):
    """Re-trigger enrichment for a single lead."""
    assert user.id is not None
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
    create_task_with_context(enrich_lead(lead_id, manager))
    return {"lead_id": lead_id, "status": "enrichment_started"}


# ─── Product Matching ─────────────────────────────────────────────────


@app.post("/api/matches/generate")
async def trigger_matching(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(_load_user_api_keys),
):
    """Generate matches for all enriched leads against all products. Fire-and-forget."""
    assert user.id is not None
    from backend.matching.pipeline import generate_all_matches

    create_task_with_context(generate_all_matches(manager, user.id))
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
    user: User = Depends(_load_user_api_keys),
):
    """Generate a pitch deck for a lead-product pair. Awaited (not fire-and-forget)."""
    assert user.id is not None
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
    user: User = Depends(_load_user_api_keys),
):
    """Generate an outreach email for a lead-product pair."""
    assert user.id is not None
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

    try:
        result = await generate_email(lead, product, reasoning)
    except Exception as exc:
        logger.exception("Email generation failed for lead %s / product %s: %s", lead_id, product_id, exc)
        raise HTTPException(status_code=500, detail=f"Email generation failed: {exc}") from exc

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


@app.get("/api/leads/{lead_id}/emails")
async def list_emails(
    lead_id: int,
    product_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all generated email versions for a lead-product pair, newest first."""
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    rows = (
        (
            await session.execute(
                select(GeneratedEmail)
                .where(GeneratedEmail.lead_id == lead_id, GeneratedEmail.product_id == product_id)
                .order_by(GeneratedEmail.created_at.desc())  # type: ignore[attr-defined]
            )
        )
        .scalars()
        .all()
    )
    return rows


@app.get("/api/leads/{lead_id}/email/latest")
async def get_latest_email(
    lead_id: int,
    product_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get the most recent generated email for a lead-product pair."""
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    email = (
        (
            await session.execute(
                select(GeneratedEmail)
                .where(GeneratedEmail.lead_id == lead_id, GeneratedEmail.product_id == product_id)
                .order_by(GeneratedEmail.created_at.desc())  # type: ignore[attr-defined]
            )
        )
        .scalars()
        .first()
    )
    if not email:
        raise HTTPException(status_code=404, detail="No email found")
    return email


# ─── LinkedIn Import ──────────────────────────────────────────────────


@app.post("/api/linkedin/import")
async def import_linkedin(
    file: UploadFile,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(_load_user_api_keys),
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

    create_task_with_context(process_linkedin_import(user.id, connections, manager, session_factory))
    return {"status": "import_started", "connections_found": len(connections)}


@app.post("/api/linkedin/demo")
async def import_linkedin_demo(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(_load_user_api_keys),
):
    """Import mock LinkedIn data for demo purposes."""
    from backend.db import async_session as session_factory
    from backend.linkedin.csv_parser import parse_connections_csv
    from backend.linkedin.mock_data import generate_mock_csv_text
    from backend.linkedin.pipeline import process_linkedin_import

    assert user.id is not None
    csv_text = generate_mock_csv_text()
    connections = parse_connections_csv(csv_text)
    create_task_with_context(process_linkedin_import(user.id, connections, manager, session_factory))
    return {"status": "demo_import_started", "connections_found": len(connections)}


@app.get("/api/linkedin/connections")
async def list_linkedin_connections(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all imported LinkedIn connections."""
    result = await session.execute(select(LinkedInConnection).where(LinkedInConnection.user_id == user.id))
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
        conn = (
            await session.execute(select(LinkedInConnection).where(LinkedInConnection.id == m.connection_id))
        ).scalar_one_or_none()
        lead = (await session.execute(select(Lead).where(Lead.id == m.lead_id))).scalar_one_or_none()

        enriched.append(
            {
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
            }
        )

    return {"matches": enriched}


@app.delete("/api/linkedin/connections")
async def clear_linkedin_connections(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Clear all LinkedIn connections and matches for the current user."""
    # Delete matches first (foreign key)
    matches = (await session.execute(select(LinkedInMatch).where(LinkedInMatch.user_id == user.id))).scalars().all()
    for m in matches:
        await session.delete(m)

    connections = (
        (await session.execute(select(LinkedInConnection).where(LinkedInConnection.user_id == user.id))).scalars().all()
    )
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


@app.get("/api/analytics/global-impact")
async def get_global_impact(session: AsyncSession = Depends(get_session)):
    """Public endpoint: total hours and $ saved across all users, customer count from Paid.ai."""
    from sqlalchemy import func as sa_func

    from backend.billing import paid_client

    rows = await session.execute(
        select(UsageEvent.event_type, sa_func.count(UsageEvent.id)).group_by(UsageEvent.event_type)  # type: ignore[arg-type]
    )
    total_hours = 0.0
    total_actions = 0
    for event_type_val, count in rows.all():
        evt = UsageEventType(event_type_val) if isinstance(event_type_val, str) else event_type_val
        total_hours += HOURS_SAVED.get(evt, 0.0) * count
        total_actions += count

    # Fetch real customer count from Paid.ai
    total_customers = 0
    if paid_client:
        try:
            result = paid_client.customers.list_customers(limit=1)
            total_customers = result.pagination.total if result.pagination else len(result.data)
        except Exception:
            logger.warning("Failed to fetch customer count from Paid.ai")

    return {
        "total_hours_saved": round(total_hours, 1),
        "total_dollars_saved": round(total_hours * SDR_HOURLY_RATE, 2),
        "total_actions": total_actions,
        "total_customers": total_customers,
    }


@app.post("/api/analytics/predict")
async def trigger_predictions(session: AsyncSession = Depends(get_session), user: User = Depends(_load_user_api_keys)):
    """Predict conversion likelihood for matches missing predictions."""
    from backend.analytics import predict_conversions

    assert user.id is not None
    create_task_with_context(predict_conversions(manager, session, user.id))
    return {"status": "prediction_started"}
