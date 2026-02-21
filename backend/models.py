"""SalesForge data models — SQLModel schemas for leads, enrichments, and pitch decks."""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel, JSON, Column


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
    fit_score: Optional[float] = None
    fit_reasoning: Optional[str] = None

    # Gemini visual analysis (Phase 3)
    brand_analysis: Optional[str] = None

    # Status tracking
    enrichment_status: EnrichmentStatus = EnrichmentStatus.PENDING

    # Action flags
    pitch_deck_generated: bool = False
    email_generated: bool = False
    voice_generated: bool = False


class PitchDeck(SQLModel, table=True):
    """A generated pitch deck for a lead."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    slides: list[PitchSlide] = Field(sa_column=Column(JSON))
    pptx_path: Optional[str] = None  # Path to generated PPTX file


class GeneratedEmail(SQLModel, table=True):
    """A generated outreach email for a lead."""
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: int = Field(foreign_key="lead.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    contact_name: str
    contact_role: str
    subject: str
    body: str


class Product(SQLModel, table=True):
    """The user's product description — used to personalize everything."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
