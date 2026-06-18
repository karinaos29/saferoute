"""
schemas.py — All Pydantic request/response models.

Every field here maps 1-to-1 to a key the React frontend
can read directly from the API response or from a Firestore doc.
"""

from __future__ import annotations
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ─── Inbound: what the frontend sends for analysis ───────────────────────────

class AnalyzeRequest(BaseModel):
    # Case identity
    case_id: Optional[str] = None          # set if doc already exists in Firestore

    # Portal context — drives which AI prompt & output shape to use
    portal_role: Literal["candidate", "institution"] = "candidate"

    # Submission fields (mirror CandidateFlow formData)
    target_name: str = Field(..., description="Name of the targeted candidate")
    platform: str = Field(..., description="Platform where content appeared")
    incident_date: str = Field(..., description="ISO date string")
    url_links: Optional[str] = None
    description: Optional[str] = None      # free-text context from submitter

    # Already-uploaded evidence file URLs from Firebase Storage
    evidence_file_urls: Optional[List[str]] = []

    # Optional: pre-extracted OCR text from images (sent after /analyze/image)
    ocr_text: Optional[str] = None


# ─── Outbound: candidate portal response ─────────────────────────────────────

class TrackAssessment(BaseModel):
    """One legal/risk track (OGBV or Hate Speech)."""
    track: Literal["OGBV Risk", "Hate Speech", "Both"]
    triggered: bool
    confidence: float = Field(..., ge=0.0, le=1.0, description="0-1 confidence score")
    rationale: str    # plain-language XAI explanation
    key_signals: List[str]   # bullet-point list of specific indicators found


class SeverityLevel(BaseModel):
    label: Literal["Low", "Medium", "High", "Critical"]
    score: int = Field(..., ge=0, le=10, description="Numeric 0-10 risk score")
    rationale: str


class ActionStep(BaseModel):
    """One step in the recommended action pathway."""
    step: int
    action: str          # e.g. "Preserve Evidence"
    detail: str          # one sentence of context
    institution: Optional[str] = None   # e.g. "Electoral Commission"
    urgency: Literal["Immediate", "Within 48h", "Routine"]


class CandidateAnalysis(BaseModel):
    """Candidate-facing output: summary + risk, no persuasive referral logic."""
    summary: str              # 2-3 sentence plain-language summary for the victim
    severity: SeverityLevel
    tracks: List[TrackAssessment]
    action_pathway: List[ActionStep]
    evidence_preserved: bool  # flag for the UI badge
    xai_rationale: str        # overall plain-language explanation of AI reasoning
    free_expression_flag: bool = False   # True if content may be protected speech


class InstitutionAnalysis(BaseModel):
    """Institution-facing output: fuller analysis + balanced suggested actions."""
    summary: str
    severity: SeverityLevel
    tracks: List[TrackAssessment]
    # Balanced, non-prescriptive next-step options
    suggested_actions: List[SuggestedAction]
    pattern_indicators: List[str]       # systemic risk signals
    legal_frameworks_applicable: List[str]   # e.g. ["DSA Art. 16", "CoE Convention"]
    xai_rationale: str
    free_expression_flag: bool
    free_expression_note: Optional[str] = None   # if flagged, brief note


class SuggestedAction(BaseModel):
    """Non-prescriptive action option for institutions."""
    title: str
    description: str
    track: Literal["OGBV Risk", "Hate Speech", "Both", "General"]
    is_removal_related: bool = False   # explicit flag for transparency
    considerations: Optional[str] = None   # balanced note (both sides)


# ─── Top-level response ──────────────────────────────────────────────────────

class AnalyzeResponse(BaseModel):
    case_id: Optional[str] = None
    portal_role: str
    ai_category: str           # "OGBV Risk" | "Hate Speech" | "Both" | "Insufficient Evidence"
    severity: str              # "Low" | "Medium" | "High" | "Critical" (for Firestore tag)
    severity_score: int        # 0-10 (for Firestore)
    status: str = "Pending Review"

    # The detailed analysis object — one of the two shapes above
    # Stored as a plain dict so Firestore can hold it directly
    analysis: dict

    # Flat fields for the dashboard table (quick access without unpacking analysis)
    short_summary: str         # ≤ 80 chars, for the table row
    xai_rationale: str
    free_expression_flag: bool = False
    tracks_triggered: List[str]   # e.g. ["OGBV Risk"] or ["OGBV Risk", "Hate Speech"]
    confidence_score: float    # overall 0-1

    # Metadata
    model_used: str = "gemini-2.0-flash"
    analyzed_at: Optional[str] = None


# ─── Image analysis ──────────────────────────────────────────────────────────

class ImageAnalyzeResponse(BaseModel):
    ocr_text: str              # extracted text
    content_type_detected: str # "text_post" | "screenshot" | "document" | "unknown"
    preliminary_flags: List[str]   # quick signal tags before full analysis
    description: str           # Gemini's description of the image content
    suggested_description: str # pre-filled description for the form textarea


# ─── Human review gate ───────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    decision: Literal["approved", "rejected", "needs_more_info"]
    reviewer_email: str
    note: Optional[str] = None
    tracks_confirmed: List[str] = []
    free_expression_considered: bool = False   # mandatory checklist item


class ReviewResponse(BaseModel):
    case_id: str
    decision: str
    new_status: str
    message: str


# ─── Full case detail (GET /api/case/{id}) ───────────────────────────────────

class CaseDetailResponse(BaseModel):
    id: str
    target_name: Optional[str] = Field(None, alias="targetName")
    platform: Optional[str] = None
    incident_date: Optional[str] = Field(None, alias="incidentDate")
    url_links: Optional[str] = Field(None, alias="urlLinks")
    description: Optional[str] = None
    ai_category: Optional[str] = Field(None, alias="aiCategory")
    severity: Optional[str] = None
    severity_score: Optional[int] = None
    status: Optional[str] = None
    submitted_by: Optional[str] = Field(None, alias="submittedBy")
    analysis: Optional[dict] = None
    short_summary: Optional[str] = None
    xai_rationale: Optional[str] = None
    free_expression_flag: Optional[bool] = None
    tracks_triggered: Optional[List[str]] = None
    human_review: Optional[dict] = Field(None, alias="humanReview")
    analyzed_at: Optional[str] = None
    created_at: Optional[str] = Field(None, alias="createdAt")

    class Config:
        populate_by_name = True
