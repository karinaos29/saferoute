"""
firebase_client.py — Firebase Admin SDK wrapper.

Uses a service account JSON (path set in .env → FIREBASE_SERVICE_ACCOUNT_PATH).
If the key is not present, all Firestore calls are no-ops so development
without Firebase still works.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Optional

log = logging.getLogger("saferoute.firebase")

_db = None


def get_firestore():
    """Lazy-init Firestore client. Returns None if unconfigured."""
    global _db
    if _db is not None:
        return _db

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    if not sa_path or not os.path.exists(sa_path):
        log.warning(
            "FIREBASE_SERVICE_ACCOUNT_PATH not set or file not found. "
            "Firestore operations will be skipped."
        )
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)

        _db = firestore.client()
        log.info("Firestore client initialised.")
        return _db
    except Exception as e:
        log.error("Failed to initialise Firestore: %s", e)
        return None


async def update_case_ai_fields(case_id: str, ai_data: dict) -> bool:
    """
    Write AI analysis fields back into an existing Firestore document.
    Returns True on success, False if Firestore is unavailable.
    """
    db = get_firestore()
    if db is None:
        log.warning("Skipping Firestore update (no client).")
        return False

    # Map AnalyzeResponse fields to the Firestore document schema
    # that the React frontend already reads.
    update_payload = {
        "aiCategory":         ai_data.get("ai_category", "Uncategorised"),
        "severity":           ai_data.get("severity", "Medium"),
        "severityScore":      ai_data.get("severity_score", 5),
        "aiAnalysis":         ai_data.get("analysis", {}),
        "shortSummary":       ai_data.get("short_summary", ""),
        "xaiRationale":       ai_data.get("xai_rationale", ""),
        "freeExpressionFlag": ai_data.get("free_expression_flag", False),
        "tracksTriggered":    ai_data.get("tracks_triggered", []),
        "confidenceScore":    ai_data.get("confidence_score", 0.0),
        "modelUsed":          ai_data.get("model_used", "gemini-2.0-flash"),
        "analyzedAt":         ai_data.get("analyzed_at", ""),
        # Keep status as Pending Review — human must review before it changes
        "status":             "Pending Review",
    }

    try:
        db.collection("cases").document(case_id).update(update_payload)
        log.info("Firestore updated for case %s", case_id)
        return True
    except Exception as e:
        log.error("Firestore update error for %s: %s", case_id, e)
        return False
