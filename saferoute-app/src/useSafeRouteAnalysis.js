/**
 * useSafeRouteAnalysis.js
 * 
 * Drop this hook into your src/ folder.
 * Import it in CandidateFlow.jsx and InstitutionDashboard.jsx.
 * 
 * Usage:
 *   const { analyze, analyzeImage, submitReview, loading, error } = useSafeRouteAnalysis();
 */

import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function useSafeRouteAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Analyze a case (text form data) ──────────────────────────────────────
  const analyze = useCallback(async ({
    caseId,          // Firestore doc ID (after addDoc)
    portalRole,      // 'candidate' | 'institution'
    targetName,
    platform,
    incidentDate,
    urlLinks,
    description,
    evidenceFileUrls,
    ocrText,         // optional: from analyzeImage()
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          portal_role: portalRole,
          target_name: targetName,
          platform,
          incident_date: incidentDate,
          url_links: urlLinks || null,
          description: description || null,
          evidence_file_urls: evidenceFileUrls || [],
          ocr_text: ocrText || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Analysis failed');
      }
      return await res.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Analyze a single image file ───────────────────────────────────────────
  const analyzeImage = useCallback(async (file, portalRole = 'candidate', contextDescription = '') => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('portal_role', portalRole);
      form.append('context_description', contextDescription);

      const res = await fetch(`${API_BASE}/api/analyze/image`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Image analysis failed');
      }
      return await res.json();
      // Returns: { ocr_text, content_type_detected, preliminary_flags, description, suggested_description }
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Submit human review decision (institution only) ───────────────────────
  const submitReview = useCallback(async ({
    caseId,
    decision,           // 'approved' | 'rejected' | 'needs_more_info'
    reviewerEmail,
    note,
    tracksConfirmed,    // string[]
    freeExpressionConsidered,  // boolean — mandatory checklist
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/case/${caseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewer_email: reviewerEmail,
          note: note || null,
          tracks_confirmed: tracksConfirmed || [],
          free_expression_considered: freeExpressionConsidered,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Review submission failed');
      }
      return await res.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { analyze, analyzeImage, submitReview, loading, error };
}


// ── Helper: render severity badge colour ─────────────────────────────────────
export function severityColor(label) {
  return {
    Low:      '#22c55e',
    Medium:   '#f59e0b',
    High:     '#ef4444',
    Critical: '#7c3aed',
  }[label] || '#6b7280';
}

// ── Helper: render track badge colour ────────────────────────────────────────
export function trackColor(track) {
  return {
    'OGBV Risk':   '#0d9488',
    'Hate Speech': '#7c3aed',
    'Both':        '#1265cc',
  }[track] || '#6b7280';
}
