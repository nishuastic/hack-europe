"""SalesForge data models — SQLModel schemas for leads, enrichments, product matching, and pitch decks."""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import JSON, Column, Field, SQLModel


class EnrichmentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    FAILED = "failed"


class Contact(SQLModel):
    """A key contact at a target company."""
    name: str
    role: str
    linkedin: Optional[str] = None
    email: Optional[str] = None


class PitchSlide(SQLModel):
    """A single slide in a pitch deck."""
    slide_number: int
    title: str
    body_html: str
    speaker_notes: str


class BuyingSignal(SQLModel):
    """A structured buying signal extracted from enrichment data."""
    # recent_funding | hiring_surge | competitor_mentioned
    # expansion | pain_indicator | tech_stack_match
    signal_type: str
    description: str        # "Raised $45M Series B in Jan 2024"
    strength: str           # "strong", "moderate", "weak"


class Lead(SQLModel, table=True):
    """A target company to enrich and pitch."""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Input fields
    company_name: str
    company_url: Optional[str] = None

    # Enrichment fields
    description: Optional[str] = None
    funding: Optional[str] = None
    industry: Optional[str] = None
    revenue: Optional[str] = None
    employees: Optional[int] = None
    contacts: Optional[list[Contact]] = Field(default=None, sa_column=Column(JSON))
    customers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    buying_signals: Optional[list[BuyingSignal]] = Field(default=None, sa_column=Column(JSON))

    # Status tracking
    enrichment_status: EnrichmentStatus = EnrichmentStatus.PENDING

    # Action flags
    pitch_deck_generated: bool = False
    email_generated: bool = False
    voice_generated: bool = False


class Product(SQLModel, table=True):
    """A product in the user's catalog — matched against leads by AI."""
    id: Optional[int] = Field(default=None, primary_key=True)
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
    differentiator: Optional[str] = None  # What makes it special / USP
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProductMatch(SQLModel, table=True):
    """AI-generated match between a Lead and a Product with score and reasoning."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    match_score: float  # 1-10
    match_reasoning: str  # Why this product fits this lead
    conversion_likelihood: Optional[str] = None   # "high", "medium", "low"
    conversion_reasoning: Optional[str] = None     # "Similar profile to 3 known converters..."
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PitchDeck(SQLModel, table=True):
    """A generated pitch deck for a specific product-lead pair."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    slides: list[PitchSlide] = Field(sa_column=Column(JSON))
    pptx_path: Optional[str] = None  # Path to generated PPTX file


class GeneratedEmail(SQLModel, table=True):
    """A generated outreach email for a specific product-lead pair."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    product_id: int = Field(foreign_key="product.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    contact_name: str
    contact_role: str
    subject: str
    body: str


class VoiceBriefing(SQLModel, table=True):
    """An ElevenLabs voice briefing for call prep."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    script: str  # The text that was spoken
    audio_path: str  # Path to audio file


class PitchHistory(SQLModel, table=True):
    """Track what pitches worked/didn't for future adaptation."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    outcome: str  # "meeting_booked", "no_response", "rejected", "interested"
    notes: Optional[str] = None
