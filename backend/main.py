"""SalesForge API — FastAPI application with WebSocket streaming."""

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.db import get_session, init_db
from backend.discovery.discovery_pipeline import run_discovery
from backend.enrichment.pipeline import enrich_lead, enrich_leads
from backend.models import CompanyProfile, EnrichmentStatus, Lead, Product

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


app = FastAPI(title="SalesForge", version="0.1.0", lifespan=lifespan)

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


class DiscoveryRequest(BaseModel):
    product_ids: list[int] | None = None
    max_companies: int = 20


class CompanyProfileUpsert(BaseModel):
    company_name: str
    website: str | None = None
    growth_stage: str | None = None
    geography: str | None = None
    value_proposition: str | None = None


class LeadImport(BaseModel):
    companies: list[str]


# ─── Product CRUD ─────────────────────────────────────────────────────


@app.post("/api/products")
async def import_products(body: BulkProductImport, session: AsyncSession = Depends(get_session)):
    created = []
    for p in body.products:
        product = Product(**p.model_dump())
        session.add(product)
        await session.commit()
        await session.refresh(product)
        created.append(product)
    return {"products": created}


@app.get("/api/products")
async def list_products(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Product))
    return {"products": result.scalars().all()}


@app.get("/api/products/{product_id}")
async def get_product(product_id: int, session: AsyncSession = Depends(get_session)):
    product = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/api/products/{product_id}")
async def update_product(product_id: int, body: ProductUpdate, session: AsyncSession = Depends(get_session)):
    product = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.add(product)
    await session.commit()
    await session.refresh(product)
    return product


@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, session: AsyncSession = Depends(get_session)):
    product = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await session.delete(product)
    await session.commit()
    return {"deleted": True}


# ─── Company Profile ──────────────────────────────────────────────────


@app.get("/api/company-profile")
async def get_company_profile(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(CompanyProfile))
    profile = result.scalar_one_or_none()
    return profile or {}


@app.put("/api/company-profile")
async def upsert_company_profile(body: CompanyProfileUpsert, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(CompanyProfile))
    profile = result.scalar_one_or_none()
    if profile:
        for field, value in body.model_dump().items():
            setattr(profile, field, value)
    else:
        profile = CompanyProfile(**body.model_dump())
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


# ─── Discovery ───────────────────────────────────────────────────────


@app.post("/api/discovery/run")
async def run_discovery_endpoint(body: DiscoveryRequest):
    """Kick off ICP-based company discovery. Fire-and-forget async pipeline."""
    asyncio.create_task(run_discovery(body.product_ids, body.max_companies, manager))
    return {
        "status": "discovery_started",
        "max_companies": body.max_companies,
    }


# ─── Lead Import + List ───────────────────────────────────────────────


@app.post("/api/leads/import")
async def import_leads(body: LeadImport, session: AsyncSession = Depends(get_session)):
    lead_ids: list[int] = []
    for company in body.companies:
        lead = Lead(company_name=company, enrichment_status=EnrichmentStatus.PENDING)
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        assert lead.id is not None
        lead_ids.append(lead.id)

    # Fire-and-forget enrichment
    asyncio.create_task(enrich_leads(lead_ids, manager))

    return {"leads_created": len(lead_ids), "lead_ids": lead_ids, "status": "enrichment_started"}


@app.get("/api/leads")
async def list_leads(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Lead))
    return {"leads": result.scalars().all()}


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int, session: AsyncSession = Depends(get_session)):
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@app.post("/api/leads/{lead_id}/enrich")
async def trigger_enrich(lead_id: int, session: AsyncSession = Depends(get_session)):
    """Re-trigger enrichment for a single lead."""
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
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
