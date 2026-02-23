"""Stick data models — SQLModel schemas for leads, enrichments, product matching, and pitch decks."""

from datetime import UTC, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, field_validator
from sqlalchemy import event
from sqlmodel import JSON, Column, Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    """A registered user."""

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    name: str = ""
    created_at: datetime = Field(default_factory=_utcnow)


class UserLinkedMixin(SQLModel):
    """Mixin for models that should be linked to a user."""

    user_id: int = Field(foreign_key="user.id", index=True)


class UsageEventType(str, Enum):
    ENRICHMENT = "enrichment"
    MATCHING = "matching"
    PITCH_DECK = "pitch_deck"
    EMAIL = "email"
    LINKEDIN_OUTREACH = "linkedin_outreach"
    ICP_RESEARCH = "icp_research"


class ICPResearchStatus(str, Enum):
    PENDING = "pending"
    RESEARCHING_CUSTOMERS = "researching_customers"
    EXTRACTING_ICP = "extracting_icp"
    COMPLETE = "complete"
    FAILED = "failed"


class UserCredits(SQLModel, table=True):
    """Tracks a user's credit balance and billing IDs."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, index=True)
    credits_remaining: int = 100
    paid_customer_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    active_tier: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_status: Optional[str] = None


class UsageEvent(SQLModel, table=True):
    """Records each billable action for usage history."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    event_type: UsageEventType
    credits_used: int
    created_at: datetime = Field(default_factory=_utcnow)


class EnrichmentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    FAILED = "failed"


class Contact(BaseModel):
    """A key contact at a target company."""

    name: str
    role: str
    linkedin: Optional[str] = None
    email: Optional[str] = None


class PitchSlide(BaseModel):
    """A single slide in a pitch deck."""

    slide_number: int
    title: str
    body_html: str
    speaker_notes: str


class BuyingSignal(BaseModel):
    """A structured buying signal extracted from enrichment data."""

    # recent_funding | hiring_surge | competitor_mentioned
    # expansion | pain_indicator | tech_stack_match
    signal_type: str
    description: str  # "Raised $45M Series B in Jan 2024"
    strength: str  # "strong", "moderate", "weak"


class LinkedInMatchStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETE = "complete"
    FAILED = "failed"


class WarmIntroOutreach(BaseModel):
    intro_message: str
    talking_points: list[str]
    context: str
    timing_suggestion: str


class LinkedInConnection(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    first_name: str
    last_name: str
    email: str | None = None
    company: str | None = None
    position: str | None = None
    connected_on: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


class LinkedInMatch(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    connection_id: int = Field(foreign_key="linkedinconnection.id")
    lead_id: int = Field(foreign_key="lead.id")
    match_confidence: str = "exact"
    outreach_plan: WarmIntroOutreach | None = Field(default=None, sa_column=Column(JSON))
    status: LinkedInMatchStatus = LinkedInMatchStatus.PENDING
    created_at: datetime = Field(default_factory=_utcnow)


class CompanyProfile(SQLModel, table=True):
    """The user's own company profile — used by AI for context when generating pitches."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    company_name: str
    website: Optional[str] = None
    growth_stage: Optional[str] = None  # Pre-Seed, Seed, Series A, Series B+, Public
    geography: Optional[str] = None  # HQ location
    value_proposition: Optional[str] = None  # What the company does
    updated_at: datetime = Field(default_factory=_utcnow)


class GenerationRun(SQLModel, table=True):
    """A single discovery generation run — tracks which products were used and results."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    status: str = "running"  # "running", "complete", "failed"
    product_ids: list[int] = Field(default_factory=list, sa_column=Column(JSON))
    product_names: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    product_snapshots: list[dict] = Field(
        default_factory=list, sa_column=Column(JSON)
    )  # Full product data at time of run
    lead_count: int = 0
    max_companies: int = 20


class Lead(SQLModel, table=True):
    """A target company to enrich and pitch."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    generation_run_id: Optional[int] = Field(default=None, foreign_key="generationrun.id", index=True)

    # Input fields
    company_name: str
    company_url: Optional[str] = None

    # Enrichment fields
    description: Optional[str] = None
    funding: Optional[str] = None
    industry: Optional[str] = None
    company_fit: Optional[str] = None
    revenue: Optional[str] = None
    employees: Optional[int] = None
    contacts: Optional[list[Contact]] = Field(default=None, sa_column=Column(JSON))
    customers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    buying_signals: Optional[list[BuyingSignal]] = Field(default=None, sa_column=Column(JSON))

    # ICP fit (scored during enrichment if ICPProfile exists)
    icp_fit_score: Optional[float] = None
    icp_fit_reasoning: Optional[str] = None

    # Status tracking
    enrichment_status: EnrichmentStatus = EnrichmentStatus.PENDING

    # Action flags
    pitch_deck_generated: bool = False
    email_generated: bool = False

    @field_validator("contacts", mode="before")
    @classmethod
    def coerce_contacts(cls, v: object) -> object:
        if isinstance(v, list):
            return [Contact(**item) if isinstance(item, dict) else item for item in v]
        return v

    @field_validator("buying_signals", mode="before")
    @classmethod
    def coerce_buying_signals(cls, v: object) -> object:
        if isinstance(v, list):
            return [BuyingSignal(**item) if isinstance(item, dict) else item for item in v]
        return v


@event.listens_for(Lead, "load")
def _receive_lead_load(target: "Lead", context: object) -> None:
    if target.contacts and isinstance(target.contacts, list):
        target.contacts = [
            Contact(**item) if isinstance(item, dict) else item
            for item in target.contacts
        ]
    if target.buying_signals and isinstance(target.buying_signals, list):
        target.buying_signals = [
            BuyingSignal(**item) if isinstance(item, dict) else item
            for item in target.buying_signals
        ]


class Product(SQLModel, table=True):
    """A product in the user's catalog — matched against leads by AI."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    description: str  # What you sell, clear simple description
    features: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))  # Main product/service features
    industry_focus: Optional[str] = None  # Industry target if any
    pricing_model: Optional[str] = None  # SaaS, project-based, retainer, etc.
    company_size_target: Optional[str] = None  # SMB, mid-market, enterprise
    geography: Optional[str] = None  # Regions served
    stage: Optional[str] = None  # startup, scaling, enterprise
    company_name: Optional[str] = None  # The selling company's name
    website: Optional[str] = None  # Seller's website
    example_clients: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))  # Reference clients
    current_clients: Optional[list[dict]] = Field(
        default=None, sa_column=Column(JSON)
    )  # [{"name": "Client", "website": "https://..."}]
    differentiator: Optional[str] = None  # What makes it special / USP
    updated_at: datetime = Field(default_factory=_utcnow)


class ProductMatch(SQLModel, table=True):
    """AI-generated match between a Lead and a Product with score and reasoning."""

    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    match_score: float  # 1-10
    match_reasoning: str  # Why this product fits this lead
    conversion_likelihood: Optional[str] = None  # "high", "medium", "low"
    conversion_reasoning: Optional[str] = None  # "Similar profile to 3 known converters..."
    created_at: datetime = Field(default_factory=_utcnow)


class PitchDeck(SQLModel, table=True):
    """A generated pitch deck for a specific product-lead pair."""

    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    created_at: datetime = Field(default_factory=_utcnow)
    slides: list[PitchSlide] = Field(sa_column=Column(JSON))
    pptx_path: Optional[str] = None  # Path to generated PPTX file

    @field_validator("slides", mode="before")
    @classmethod
    def coerce_slides(cls, v: object) -> list[PitchSlide]:
        if isinstance(v, list):
            return [PitchSlide(**item) if isinstance(item, dict) else item for item in v]
        return v  # type: ignore[return-value]


class GeneratedEmail(SQLModel, table=True):
    """A generated outreach email for a specific product-lead pair."""

    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    created_at: datetime = Field(default_factory=_utcnow)
    contact_name: str
    contact_role: str
    subject: str
    body: str


class PitchHistory(SQLModel, table=True):
    """Track what pitches worked/didn't for future adaptation."""

    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    created_at: datetime = Field(default_factory=_utcnow)
    outcome: str  # "meeting_booked", "no_response", "rejected", "interested"
    notes: Optional[str] = None


class CustomerResearch(SQLModel, table=True):
    """Researched data for a single customer used in ICP learning."""

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    customer_name: str
    customer_url: str
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    revenue: Optional[str] = None
    funding_stage: Optional[str] = None
    geography: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    raw_research: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow)


class ICPProfile(SQLModel, table=True):
    """Derived Ideal Customer Profile rubrics per product."""

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", unique=True, index=True)
    status: ICPResearchStatus = ICPResearchStatus.PENDING
    target_industries: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    employee_range_min: Optional[int] = None
    employee_range_max: Optional[int] = None
    revenue_range: Optional[str] = None
    funding_stages: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    geographies: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    common_traits: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    anti_patterns: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    icp_summary: Optional[str] = None
    customers_researched: int = 0
    created_at: datetime = Field(default_factory=_utcnow)
