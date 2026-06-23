"""
SafeRoute Backend — main.py
FastAPI + Gemini AI analysis engine.

Routes:
  POST /api/analyze          — full AI analysis (called right after upload)
  POST /api/analyze/image    — multipart image analysis (OCR + NLP on screenshot)
  GET  /api/case/{case_id}   — fetch enriched case from Firestore
  POST /api/case/{case_id}/review  — operator human-review gate (approve/reject)

All responses are flat JSON shaped for easy React consumption.
"""

import os
import io
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from PIL import Image

from config import settings
from firebase_client import get_firestore, update_case_ai_fields
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ImageAnalyzeResponse,
    ReviewRequest,
    ReviewResponse,
    CaseDetailResponse,
)
from analyzer import SafeRouteAnalyzer

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("saferoute")

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SafeRoute API",
    version="1.0.0",
    description="AI-powered evidence analysis and routing for online hate and OGBV cases.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Gemini init ─────────────────────────────────────────────────────────────
analyzer = SafeRouteAnalyzer()


# ════════════════════════════════════════════════════════════════════════════
# POST /api/analyze
# Called by CandidateFlow after Firestore doc is created.
# Receives the case payload as JSON, returns AI analysis.
# The frontend then writes the AI fields back into Firestore.
# ════════════════════════════════════════════════════════════════════════════
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_case(req: AnalyzeRequest):
    log.info("Analyzing case: %s (role=%s)", req.case_id or "NEW", req.portal_role)
    try:
        result = await analyzer.analyze(req)
    except Exception as e:
        log.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))

    
    if req.case_id:
        try:
            await update_case_ai_fields(req.case_id, result.model_dump())
        except Exception as e:
            log.warning("Firestore update failed (non-fatal): %s", e)

    return result


# ════════════════════════════════════════════════════════════════════════════
# POST /api/analyze/image
# Accepts a multipart image upload; runs OCR + contextual analysis via Gemini.
# Can be called independently for evidence screenshots.
# ════════════════════════════════════════════════════════════════════════════
@app.post("/api/analyze/image", response_model=ImageAnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...),
    portal_role: str = Form("candidate"),
    context_description: str = Form(""),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    raw = await file.read()
   
    img = Image.open(io.BytesIO(raw))
    if max(img.size) > 2000:
        img.thumbnail((2000, 2000))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw = buf.getvalue()

    b64 = base64.b64encode(raw).decode()
    try:
        result = await analyzer.analyze_image(b64, file.content_type, portal_role, context_description)
    except Exception as e:
        log.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail=str(e))

    return result


# ════════════════════════════════════════════════════════════════════════════
# GET /api/case/{case_id}
# Returns enriched case data from Firestore for React to render.
# ════════════════════════════════════════════════════════════════════════════
@app.get("/api/case/{case_id}", response_model=CaseDetailResponse)
async def get_case(case_id: str):
    db = get_firestore()
    doc = db.collection("cases").document(case_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Case not found.")
    data = doc.to_dict()
    data["id"] = case_id
    return CaseDetailResponse(**_normalise_case(data))


# ════════════════════════════════════════════════════════════════════════════
# POST /api/case/{case_id}/review
# Human-review gate — operator approves or rejects AI classification.
# This is the mandatory sign-off before any external referral can occur.
# ════════════════════════════════════════════════════════════════════════════
@app.post("/api/case/{case_id}/review", response_model=ReviewResponse)
async def human_review(case_id: str, req: ReviewRequest):
    db = get_firestore()
    doc_ref = db.collection("cases").document(case_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Case not found.")

    review_record = {
        "humanReview": {
            "status": req.decision,          # "approved" | "rejected" | "needs_more_info"
            "reviewedBy": req.reviewer_email,
            "note": req.note or "",
            "tracks_confirmed": req.tracks_confirmed,
            "free_expression_considered": req.free_expression_considered,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        "status": _map_decision_to_status(req.decision),
    }
    doc_ref.update(review_record)
    log.info("Case %s reviewed: %s by %s", case_id, req.decision, req.reviewer_email)
    return ReviewResponse(
        case_id=case_id,
        decision=req.decision,
        new_status=review_record["status"],
        message="Human review recorded. Case status updated.",
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _map_decision_to_status(decision: str) -> str:
    return {
        "approved": "Approved — Pending Referral",
        "rejected": "Rejected — Insufficient Evidence",
        "needs_more_info": "Pending Review",
    }.get(decision, "Pending Review")


def _normalise_case(d: dict) -> dict:
    """Flatten Firestore Timestamp objects for Pydantic."""
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif hasattr(v, "timestamp"):      
            d[k] = datetime.fromtimestamp(v.timestamp(), tz=timezone.utc).isoformat()
    return d


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/api/diagnostics")
async def diagnostics():
    report = {
        "gemini_key_configured": False,
        "gemini_key_preview": None,
        "model": None,
        "gemini_call_ok": False,
        "gemini_error": None,
    }
    key = settings.GEMINI_API_KEY or ""
    if key and key != "your_gemini_api_key_here":
        report["gemini_key_configured"] = True
        report["gemini_key_preview"] = key[:6] + "..." + key[-4:]

    from analyzer import MODEL
    report["model"] = MODEL

    if report["gemini_key_configured"]:
        try:
            from google import genai
            client = genai.Client(api_key=key)
            resp = client.models.generate_content(
                model=MODEL,
                contents="Reply with the single word: OK",
            )
            report["gemini_call_ok"] = True
            report["gemini_sample_reply"] = (resp.text or "").strip()[:50]
        except Exception as e:
            report["gemini_error"] = f"{type(e).__name__}: {str(e)}"
    else:
        report["gemini_error"] = "GEMINI_API_KEY is not set in .env"

    return report
