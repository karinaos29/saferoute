"""
analyzer.py — SafeRoute AI Analysis Engine

Uses google-genai (new SDK).
Two distinct prompt strategies:
  • candidate_prompt  — victim-facing: summary + risk score, no persuasion
  • institution_prompt — institution-facing: balanced options, freedom of expression
                         note on any suggested action that is removal-related
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone

from google import genai
from google.genai import types as genai_types

from schemas import AnalyzeRequest, AnalyzeResponse, ImageAnalyzeResponse

log = logging.getLogger("saferoute.analyzer")

SAFETY = [
    genai_types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",        threshold="BLOCK_ONLY_HIGH"),
    genai_types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",       threshold="BLOCK_ONLY_HIGH"),
    genai_types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
    genai_types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
]

MODEL = "gemini-2.5-flash"

SYSTEM_CONTEXT = """
You are SafeRoute's AI classification and analysis engine. SafeRoute is a platform
that helps victims of online hate speech and gender-based violence (OGBV) route
evidence to the right institutional actors.

You follow the DRI (Democracy Reporting International) dual-track framework:

TRACK A — OGBV RISK
• Core issue: gendered abuse targeting democratic participation (no binary legal
  threshold required)
• DSA logic: systemic risk assessment and mitigation
• Key question: Does this content or pattern create risks for safety, visibility,
  participation, or equal access to public debate?

TRACK B — HATE SPEECH
• Core issue: speech that may be illegal under EU or Member State law
• DSA logic: notice-and-action for suspected illegal content
• Key question: Does this content potentially violate applicable law?

CRITICAL PRINCIPLES you must always apply:
1. PROPORTIONALITY — calibrate severity to actual evidence, not assumptions
2. FREEDOM OF EXPRESSION — political debate, criticism of candidates, satire,
   and hyperbole are protected. Flag content that might be protected speech.
3. NO AUTOMATIC CENSORSHIP — your output is evidence routing, not moderation.
   You never recommend automatic content removal.
4. EXPLAINABILITY — every classification must include a plain-language rationale.
5. HUMAN REVIEW — you are advisory only. All outputs are subject to operator review.

You MUST respond with valid JSON only. No markdown, no code fences, no preamble.
"""


class SafeRouteAnalyzer:

    def __init__(self):
        from config import settings
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # ════════════════════════════════════════════════════════════════════════
    # Public: analyze a full case
    # ════════════════════════════════════════════════════════════════════════
    async def analyze(self, req: AnalyzeRequest) -> AnalyzeResponse:
        if req.portal_role == "candidate":
            raw = await self._call_gemini(self._candidate_prompt(req))
        else:
            raw = await self._call_gemini(self._institution_prompt(req))
        return self._build_response(req, raw)

    # ════════════════════════════════════════════════════════════════════════
    # Public: analyze a single image
    # ════════════════════════════════════════════════════════════════════════
    async def analyze_image(self, b64_image: str, mime_type: str,
                             portal_role: str, context: str) -> ImageAnalyzeResponse:
        raw = await self._call_gemini_multimodal(self._image_prompt(context), b64_image, mime_type)
        return ImageAnalyzeResponse(
            ocr_text=raw.get("ocr_text", ""),
            content_type_detected=raw.get("content_type_detected", "unknown"),
            preliminary_flags=raw.get("preliminary_flags", []),
            description=raw.get("description", ""),
            suggested_description=raw.get("suggested_description", ""),
        )

    # ════════════════════════════════════════════════════════════════════════
    # CANDIDATE PROMPT
    # ════════════════════════════════════════════════════════════════════════
    def _candidate_prompt(self, req: AnalyzeRequest) -> str:
        ocr_section = f"\nOCR TEXT FROM EVIDENCE IMAGES:\n{req.ocr_text}\n" if req.ocr_text else ""
        return f"""
PORTAL: Candidate / Victim Portal
TASK: Analyze the following incident report. The output will be shown directly
to the victim to help them understand what happened, how serious it is, and
what steps they can take. Be clear, factual, and compassionate. Do NOT be
persuasive or tell the user what they MUST do — offer informed options.

INCIDENT DATA:
- Target name: {req.target_name}
- Platform: {req.platform}
- Incident date: {req.incident_date}
- URL provided: {req.url_links or 'None'}
- Description from submitter: {req.description or 'None provided'}
- Number of evidence files uploaded: {len(req.evidence_file_urls or [])}
{ocr_section}

Return ONLY this JSON structure (no markdown, no extra text):
{{
  "summary": "<2-3 sentences in plain language summarising what was reported and why it matters for democratic participation. Avoid jargon.>",
  "severity": {{
    "label": "<Low|Medium|High|Critical>",
    "score": <0-10>,
    "rationale": "<1-2 sentences explaining the score based on the specific evidence>",
    "key_factors": ["<factor 1>", "<factor 2>"]
  }},
  "tracks": [
    {{
      "track": "OGBV Risk",
      "triggered": <true|false>,
      "confidence": <0.0-1.0>,
      "rationale": "<1-2 sentences explaining why this track applies or does not>",
      "key_signals": ["<specific signal found in the evidence>"]
    }},
    {{
      "track": "Hate Speech",
      "triggered": <true|false>,
      "confidence": <0.0-1.0>,
      "rationale": "<1-2 sentences explaining why this track applies or does not>",
      "key_signals": ["<specific signal found in the evidence>"]
    }}
  ],
  "action_pathway": [
    {{
      "step": 1,
      "action": "<short action title>",
      "detail": "<one sentence of plain-language guidance>",
      "institution": "<optional institution name or null>",
      "urgency": "<Immediate|Within 48h|Routine>"
    }}
  ],
  "evidence_preserved": true,
  "xai_rationale": "<Plain-language paragraph explaining what signals led to this classification.>",
  "free_expression_flag": <true|false>,
  "free_expression_note": "<If flagged, explain briefly. Otherwise null.>",
  "short_summary": "<max 80 characters — for dashboard table display>"
}}

RULES:
- tracks array must always have exactly 2 objects (OGBV Risk and Hate Speech)
- action_pathway must have 3-5 steps
- Never recommend account suspension or automatic content removal
"""

    # ════════════════════════════════════════════════════════════════════════
    # INSTITUTION PROMPT
    # ════════════════════════════════════════════════════════════════════════
    def _institution_prompt(self, req: AnalyzeRequest) -> str:
        ocr_section = f"\nOCR TEXT FROM EVIDENCE:\n{req.ocr_text}\n" if req.ocr_text else ""
        return f"""
PORTAL: Institution Portal (Electoral Commission / NGO / Platform Integrity)
TASK: Produce a professional case analysis. Present BALANCED suggested actions —
not prescriptive instructions. The institution applies independent judgement.

INCIDENT DATA:
- Target name: {req.target_name}
- Platform: {req.platform}
- Incident date: {req.incident_date}
- URL provided: {req.url_links or 'None'}
- Description: {req.description or 'None provided'}
- Evidence files: {len(req.evidence_file_urls or [])}
{ocr_section}

Return ONLY this JSON structure (no markdown, no extra text):
{{
  "summary": "<Professional 2-3 sentence summary using institutional language.>",
  "severity": {{
    "label": "<Low|Medium|High|Critical>",
    "score": <0-10>,
    "rationale": "<Why this severity? Reference specific indicators.>",
    "key_factors": ["<factor>"]
  }},
  "tracks": [
    {{
      "track": "OGBV Risk",
      "triggered": <true|false>,
      "confidence": <0.0-1.0>,
      "rationale": "<Explain in terms of DSA systemic risk logic.>",
      "key_signals": ["<signal>"]
    }},
    {{
      "track": "Hate Speech",
      "triggered": <true|false>,
      "confidence": <0.0-1.0>,
      "rationale": "<Explain in terms of DSA notice-and-action.>",
      "key_signals": ["<signal>"]
    }}
  ],
  "suggested_actions": [
    {{
      "title": "<Action title>",
      "description": "<Balanced description of what this action would involve.>",
      "track": "<OGBV Risk|Hate Speech|Both|General>",
      "is_removal_related": <true|false>,
      "considerations": "<Note reasons FOR and reasons for CAUTION, especially re: freedom of expression.>"
    }}
  ],
  "pattern_indicators": ["<Systemic risk signal or 'Insufficient data to detect patterns'>"],
  "legal_frameworks_applicable": ["<e.g. DSA Article 16, CoE Budapest Convention, ECHR Article 10>"],
  "xai_rationale": "<Full paragraph explaining classification rationale with confidence levels.>",
  "free_expression_flag": <true|false>,
  "free_expression_note": "<If flagged: what aspects might be protected expression. Otherwise null.>",
  "short_summary": "<max 80 characters — for dashboard table>"
}}

RULES:
- suggested_actions: 3-5 options, always include at least one NOT removal-related
- Every suggested_action must have a considerations field acknowledging both sides
- legal_frameworks_applicable must always include ECHR Article 10
- Never recommend automatic content removal
"""

    # ════════════════════════════════════════════════════════════════════════
    # IMAGE PROMPT
    # ════════════════════════════════════════════════════════════════════════
    def _image_prompt(self, context: str) -> str:
        return f"""
Analyze this image submitted as evidence for an online hate or OGBV report.
Context from submitter: {context or 'None provided'}

Return ONLY this JSON:
{{
  "ocr_text": "<all extracted text>",
  "content_type_detected": "<text_post|screenshot|document|image_meme|video_thumbnail|unknown>",
  "preliminary_flags": ["<brief signal tag>"],
  "description": "<Factual description of what the image shows>",
  "suggested_description": "<Pre-filled text the victim can use in the description field>"
}}
"""

    # ════════════════════════════════════════════════════════════════════════
    # Gemini API calls (new google.genai SDK)
    # ════════════════════════════════════════════════════════════════════════
    async def _call_gemini(self, prompt: str) -> dict:
        response = self.client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_CONTEXT,
                temperature=0.1,
                top_p=0.9,
                response_mime_type="application/json",
                safety_settings=SAFETY,
            ),
        )
        return self._extract_json(response.text)

    async def _call_gemini_multimodal(self, prompt: str, b64: str, mime: str) -> dict:
        image_part = genai_types.Part.from_bytes(
            data=__import__("base64").b64decode(b64),
            mime_type=mime,
        )
        response = self.client.models.generate_content(
            model=MODEL,
            contents=[prompt, image_part],
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_CONTEXT,
                temperature=0.1,
                response_mime_type="application/json",
                safety_settings=SAFETY,
            ),
        )
        return self._extract_json(response.text)

    # ════════════════════════════════════════════════════════════════════════
    # Helpers
    # ════════════════════════════════════════════════════════════════════════
    @staticmethod
    def _extract_json(text: str) -> dict:
        text = text.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            log.error("JSON parse failed: %s\nRaw: %s", e, text[:500])
            raise ValueError(f"Gemini returned invalid JSON: {e}")

    def _build_response(self, req: AnalyzeRequest, parsed: dict) -> AnalyzeResponse:
        tracks = parsed.get("tracks", [])
        triggered = [t["track"] for t in tracks if t.get("triggered")]
        if len(triggered) == 2:
            ai_category = "Both"
        elif triggered:
            ai_category = triggered[0]
        else:
            ai_category = "Insufficient Evidence"

        severity = parsed.get("severity", {})
        confidences = [t.get("confidence", 0) for t in tracks if t.get("triggered")]
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return AnalyzeResponse(
            case_id=req.case_id,
            portal_role=req.portal_role,
            ai_category=ai_category,
            severity=severity.get("label", "Medium"),
            severity_score=severity.get("score", 5),
            analysis=parsed,
            short_summary=parsed.get("short_summary", "")[:80],
            xai_rationale=parsed.get("xai_rationale", ""),
            free_expression_flag=parsed.get("free_expression_flag", False),
            tracks_triggered=triggered,
            confidence_score=round(overall_confidence, 2),
            model_used=MODEL,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
        )
