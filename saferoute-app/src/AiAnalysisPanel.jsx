/**
 * AiAnalysisPanel.jsx
 * 
 * Drop-in React component that renders the AI analysis response
 * for both candidate and institution portals.
 * 
 * Props:
 *   analysis  — the full `analysis` object from AnalyzeResponse
 *   role      — 'candidate' | 'institution'
 */

import React, { useState } from 'react';
import { severityColor, trackColor } from './useSafeRouteAnalysis';

const s = {
  panel: { borderRadius: '16px', border: '1px solid rgba(28,46,84,0.1)', overflow: 'hidden', fontFamily: 'inherit' },
  header: { padding: '20px 24px', borderBottom: '1px solid rgba(28,46,84,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: '15px', fontWeight: '700', margin: 0 },
  body: { padding: '24px' },
  section: { marginBottom: '24px' },
  label: { fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8aaad0', marginBottom: '10px', display: 'block' },
  summaryText: { fontSize: '15px', lineHeight: '1.65', color: '#2a4a7a' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  badge: (color) => ({ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: '600', background: color + '18', color }),
  severityBlock: (color) => ({ borderRadius: '12px', padding: '16px 20px', background: color + '10', border: `1px solid ${color}30` }),
  severityScore: (color) => ({ fontSize: '36px', fontWeight: '800', color, lineHeight: 1 }),
  trackCard: { borderRadius: '12px', padding: '16px', border: '1px solid rgba(28,46,84,0.08)', background: '#f8faff', marginBottom: '8px' },
  trackHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  trackName: (color) => ({ fontSize: '13px', fontWeight: '700', color }),
  confidence: { fontSize: '12px', color: '#8aaad0' },
  rationale: { fontSize: '13px', color: '#2a4a7a', lineHeight: '1.55', marginBottom: '8px' },
  signalList: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' },
  signal: { fontSize: '11px', padding: '3px 10px', borderRadius: '100px', background: 'rgba(28,46,84,0.06)', color: '#2a4a7a', fontWeight: '500' },
  stepRow: { display: 'flex', gap: '14px', padding: '12px 0', borderBottom: '1px solid rgba(28,46,84,0.06)' },
  stepNum: (urgency) => ({
    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: '800', color: '#fff',
    background: { Immediate: '#ef4444', 'Within 48h': '#f59e0b', Routine: '#0d9488' }[urgency] || '#6b7280',
  }),
  stepContent: { flex: 1 },
  stepTitle: { fontSize: '14px', fontWeight: '600', marginBottom: '2px', color: '#1a0d08' },
  stepDetail: { fontSize: '13px', color: '#6b7280', lineHeight: '1.5' },
  actionCard: { borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(28,46,84,0.08)', marginBottom: '10px', background: '#fff' },
  actionTitle: { fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#1a0d08', display: 'flex', alignItems: 'center', gap: '8px' },
  actionDesc: { fontSize: '13px', color: '#2a4a7a', lineHeight: '1.55', marginBottom: '8px' },
  considerations: { fontSize: '12px', color: '#8aaad0', lineHeight: '1.5', fontStyle: 'italic', borderTop: '1px solid rgba(28,46,84,0.06)', paddingTop: '8px', marginTop: '8px' },
  xaiBox: { background: 'rgba(18,101,204,0.04)', borderRadius: '12px', padding: '16px 20px', border: '1px solid rgba(18,101,204,0.12)' },
  xaiText: { fontSize: '13px', color: '#2a4a7a', lineHeight: '1.65' },
  freeExprFlag: { background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' },
  freeExprText: { fontSize: '13px', color: '#92400e', lineHeight: '1.55' },
  pill: { padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600' },
};

export default function AiAnalysisPanel({ analysis, role }) {
  const [xaiOpen, setXaiOpen] = useState(false);

  if (!analysis) return null;

  const {
    summary, severity, tracks = [], action_pathway = [],
    suggested_actions = [], xai_rationale, free_expression_flag,
    free_expression_note, pattern_indicators = [],
    legal_frameworks_applicable = [], evidence_preserved,
  } = analysis;

  const sevColor = severityColor(severity?.label);

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={{ ...s.header, background: '#f0f6ff' }}>
        <span style={s.title}>AI Analysis</span>
        <div style={s.row}>
          {evidence_preserved && (
            <span style={s.badge('#0d9488')}>✓ Evidence Preserved</span>
          )}
          <span style={s.badge(sevColor)}>{severity?.label} Risk</span>
        </div>
      </div>

      <div style={s.body}>

        {/* Free expression flag */}
        {free_expression_flag && (
          <div style={s.freeExprFlag}>
            <span style={{ fontSize: '18px' }}>⚖</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                Freedom of Expression — Review Carefully
              </div>
              <div style={s.freeExprText}>{free_expression_note}</div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={s.section}>
          <span style={s.label}>Summary</span>
          <p style={s.summaryText}>{summary}</p>
        </div>

        {/* Severity */}
        <div style={s.section}>
          <span style={s.label}>Severity Assessment</span>
          <div style={s.severityBlock(sevColor)}>
            <div style={s.row}>
              <div style={s.severityScore(sevColor)}>{severity?.score}<span style={{ fontSize: '16px', color: '#8aaad0' }}>/10</span></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px', color: sevColor }}>{severity?.label}</div>
                <div style={{ fontSize: '13px', color: '#2a4a7a', lineHeight: '1.5' }}>{severity?.rationale}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dual Tracks */}
        <div style={s.section}>
          <span style={s.label}>Dual-Track Classification</span>
          {tracks.map((t, i) => {
            const tc = trackColor(t.track);
            return (
              <div key={i} style={{ ...s.trackCard, borderLeft: `3px solid ${t.triggered ? tc : '#e5e7eb'}` }}>
                <div style={s.trackHeader}>
                  <span style={s.trackName(t.triggered ? tc : '#9ca3af')}>
                    {t.triggered ? '●' : '○'} {t.track}
                  </span>
                  <div style={s.row}>
                    <span style={s.confidence}>Confidence: {Math.round(t.confidence * 100)}%</span>
                    <span style={{ ...s.pill, background: t.triggered ? tc + '18' : '#f3f4f6', color: t.triggered ? tc : '#9ca3af' }}>
                      {t.triggered ? 'Triggered' : 'Not triggered'}
                    </span>
                  </div>
                </div>
                <p style={s.rationale}>{t.rationale}</p>
                {t.key_signals?.length > 0 && (
                  <div style={s.signalList}>
                    {t.key_signals.map((sig, j) => <span key={j} style={s.signal}>{sig}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Candidate: Action Pathway */}
        {role === 'candidate' && action_pathway.length > 0 && (
          <div style={s.section}>
            <span style={s.label}>Recommended Action Pathway</span>
            {action_pathway.map((step, i) => (
              <div key={i} style={s.stepRow}>
                <div style={s.stepNum(step.urgency)}>{step.step}</div>
                <div style={s.stepContent}>
                  <div style={s.stepTitle}>{step.action}{step.institution ? ` — ${step.institution}` : ''}</div>
                  <div style={s.stepDetail}>{step.detail}</div>
                  <span style={{ ...s.pill, background: '#f3f4f6', color: '#6b7280', marginTop: '4px', display: 'inline-block', fontSize: '11px' }}>
                    {step.urgency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Institution: Suggested Actions */}
        {role === 'institution' && suggested_actions.length > 0 && (
          <div style={s.section}>
            <span style={s.label}>Suggested Actions</span>
            <p style={{ fontSize: '12px', color: '#8aaad0', marginBottom: '12px', fontStyle: 'italic' }}>
              These are options for your consideration. Final decisions rest with your institution.
            </p>
            {suggested_actions.map((a, i) => (
              <div key={i} style={s.actionCard}>
                <div style={s.actionTitle}>
                  {a.title}
                  {a.is_removal_related && (
                    <span style={{ ...s.pill, background: '#fef3c7', color: '#92400e', fontSize: '10px' }}>
                      ⚠ Removal-related
                    </span>
                  )}
                  <span style={s.badge(trackColor(a.track))}>{a.track}</span>
                </div>
                <p style={s.actionDesc}>{a.description}</p>
                {a.considerations && (
                  <div style={s.considerations}>⚖ {a.considerations}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Institution extras */}
        {role === 'institution' && (
          <>
            {pattern_indicators.length > 0 && (
              <div style={s.section}>
                <span style={s.label}>Pattern Indicators</span>
                <div style={s.signalList}>
                  {pattern_indicators.map((p, i) => <span key={i} style={{ ...s.signal, background: 'rgba(124,58,237,0.06)', color: '#7c3aed' }}>{p}</span>)}
                </div>
              </div>
            )}
            {legal_frameworks_applicable.length > 0 && (
              <div style={s.section}>
                <span style={s.label}>Applicable Legal Frameworks</span>
                <div style={s.signalList}>
                  {legal_frameworks_applicable.map((f, i) => <span key={i} style={{ ...s.signal, background: 'rgba(14,109,212,0.06)', color: '#0e6dd4' }}>{f}</span>)}
                </div>
              </div>
            )}
          </>
        )}

        {/* XAI Rationale — collapsible */}
        <div style={s.section}>
          <button
            onClick={() => setXaiOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, marginBottom: '10px' }}
          >
            <span style={s.label} style={{ margin: 0 }}>Explainable AI Rationale</span>
            <span style={{ fontSize: '11px', color: '#8aaad0' }}>{xaiOpen ? '▲ hide' : '▼ show'}</span>
          </button>
          {xaiOpen && (
            <div style={s.xaiBox}>
              <p style={s.xaiText}>{xai_rationale}</p>
            </div>
          )}
        </div>

        <p style={{ fontSize: '11px', color: '#c0cce0', marginTop: '8px' }}>
          This analysis is AI-generated and subject to mandatory human review before any referral.
          All classifications are advisory only.
        </p>
      </div>
    </div>
  );
}
