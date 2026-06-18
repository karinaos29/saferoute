# SafeRoute Backend — Integration Guide

## Directory structure

```
saferoute-backend/
├── main.py                  ← FastAPI app + routes
├── analyzer.py              ← Gemini AI engine
├── schemas.py               ← All Pydantic models
├── firebase_client.py       ← Firestore admin client
├── config.py                ← Settings (reads .env)
├── requirements.txt
├── .env.example             ← Copy → .env, fill in secrets
│
├── useSafeRouteAnalysis.js  ← Copy into your src/
└── AiAnalysisPanel.jsx      ← Copy into your src/
```

---

## 1. Get your keys

### Gemini API key
1. Go to https://aistudio.google.com/app/apikey
2. Create a new key
3. Paste into `.env` → `GEMINI_API_KEY=...`

### Firebase service account
1. Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key** → download JSON
3. Save as `serviceAccountKey.json` in the backend folder
4. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` in `.env`

---

## 2. Run the backend

```bash
cd saferoute-backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then edit .env with your keys
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## 3. Wire up your frontend

### Add the env variable

In `saferoute-app/.env`:
```
VITE_API_BASE_URL=http://localhost:8000
```

### Copy the React files

```bash
cp useSafeRouteAnalysis.js  saferoute-app/src/
cp AiAnalysisPanel.jsx       saferoute-app/src/
```

---

## 4. Update CandidateFlow.jsx

Replace the mock `setTimeout` block in `handleSubmit` with a real API call.

```jsx
// At the top of CandidateFlow.jsx
import { useSafeRouteAnalysis } from './useSafeRouteAnalysis';
import AiAnalysisPanel from './AiAnalysisPanel';

// Inside the component
const { analyze, analyzeImage, loading, error } = useSafeRouteAnalysis();
const [aiResult, setAiResult] = useState(null);

// Replace the setTimeout block with:
const docRef = await addDoc(collection(db, 'cases'), {
  targetName: formData.targetName,
  platform: finalPlatform,
  incidentDate: formData.incidentDate,
  urlLinks: formData.urlLinks,
  description: formData.description,
  evidenceFiles: uploadedUrls,
  status: 'Pending Review',
  submittedBy: user.email,
  createdAt: serverTimestamp()
});

// Call the AI
const result = await analyze({
  caseId: docRef.id,
  portalRole: 'candidate',
  targetName: formData.targetName,
  platform: finalPlatform,
  incidentDate: formData.incidentDate,
  urlLinks: formData.urlLinks,
  description: formData.description,
  evidenceFileUrls: uploadedUrls.map(f => f.url),
});

if (result) {
  setAiResult(result);
  // Update Firestore with AI fields
  await updateDoc(docRef, {
    aiCategory: result.ai_category,
    severity: result.severity,
    severityScore: result.severity_score,
    aiAnalysis: result.analysis,
    shortSummary: result.short_summary,
    xaiRationale: result.xai_rationale,
    freeExpressionFlag: result.free_expression_flag,
    tracksTriggered: result.tracks_triggered,
    analyzedAt: result.analyzed_at,
  });
}
setStatus('complete');
```

In the `complete` state, render the panel:
```jsx
{aiResult && (
  <AiAnalysisPanel analysis={aiResult.analysis} role="candidate" />
)}
```

---

## 5. Update InstitutionDashboard.jsx

In the case detail view, add the AI panel and human review gate:

```jsx
import { useSafeRouteAnalysis } from './useSafeRouteAnalysis';
import AiAnalysisPanel from './AiAnalysisPanel';

// Inside case detail JSX, after the existing grid:
{selectedCase.aiAnalysis && (
  <AiAnalysisPanel 
    analysis={selectedCase.aiAnalysis} 
    role="institution" 
  />
)}

// Human review gate (add below evidence files section):
<HumanReviewGate 
  caseId={selectedCase.id}
  reviewerEmail={user.email}
  currentStatus={selectedCase.status}
/>
```

### HumanReviewGate component (inline in InstitutionDashboard.jsx):

```jsx
function HumanReviewGate({ caseId, reviewerEmail, currentStatus }) {
  const { submitReview, loading } = useSafeRouteAnalysis();
  const [note, setNote] = useState('');
  const [foeConsidered, setFoeConsidered] = useState(false);

  const handleReview = async (decision) => {
    if (!foeConsidered) {
      alert('Please confirm you have considered freedom of expression implications.');
      return;
    }
    await submitReview({
      caseId,
      decision,
      reviewerEmail,
      note,
      tracksConfirmed: [],
      freeExpressionConsidered: foeConsidered,
    });
  };

  if (currentStatus !== 'Pending Review') return (
    <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #86efac' }}>
      ✓ Human review completed — Status: <strong>{currentStatus}</strong>
    </div>
  );

  return (
    <div style={{ borderTop: '2px solid rgba(28,46,84,0.1)', paddingTop: '24px', marginTop: '24px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Human Review Gate</h3>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        No referral occurs without your explicit approval. Review the AI analysis above,
        then record your decision below.
      </p>
      
      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={foeConsidered} onChange={e => setFoeConsidered(e.target.checked)} />
        <span style={{ fontSize: '13px' }}>
          I have considered whether any content in this case may constitute 
          protected political speech or freedom of expression.
        </span>
      </label>

      <textarea 
        placeholder="Add review note (optional)..." 
        value={note} onChange={e => setNote(e.target.value)}
        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(28,46,84,0.15)', marginBottom: '16px', fontSize: '13px', resize: 'vertical' }}
        rows={3}
      />
      
      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn-solid" disabled={loading} onClick={() => handleReview('approved')}>
          Approve for Referral
        </button>
        <button className="btn-outline" disabled={loading} onClick={() => handleReview('needs_more_info')}>
          Request More Information
        </button>
        <button style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }} 
          disabled={loading} onClick={() => handleReview('rejected')}>
          Reject Case
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Image upload OCR (optional enhancement)

When a user selects files, call `analyzeImage` on each image before submission:

```jsx
const handleFileChange = async (e) => {
  const selected = Array.from(e.target.files);
  setFiles(selected);
  
  // Run OCR on first image immediately
  const imageFiles = selected.filter(f => f.type.startsWith('image/'));
  if (imageFiles.length > 0) {
    const imgResult = await analyzeImage(imageFiles[0], 'candidate', formData.description);
    if (imgResult?.suggested_description && !formData.description) {
      setFormData(prev => ({ ...prev, description: imgResult.suggested_description }));
    }
    setOcrText(imgResult?.ocr_text || '');
  }
};
```

---

## API Reference

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| POST | `/api/analyze` | `AnalyzeRequest` JSON | `AnalyzeResponse` |
| POST | `/api/analyze/image` | multipart `file` + `portal_role` | `ImageAnalyzeResponse` |
| GET | `/api/case/{id}` | — | `CaseDetailResponse` |
| POST | `/api/case/{id}/review` | `ReviewRequest` JSON | `ReviewResponse` |
| GET | `/health` | — | `{ status: "ok" }` |

---

## Key JSON fields consumed by React

### From `AnalyzeResponse` (top level):
```
ai_category         → Firestore aiCategory tag
severity            → label string for badge
severity_score      → 0-10 for progress bar
short_summary       → dashboard table row text
tracks_triggered    → string[] for track badges
free_expression_flag → boolean for warning banner
```

### From `analysis` (the nested object):
```
summary             → human-readable paragraph for victim
severity.score      → number for display
tracks[].rationale  → XAI per-track explanation
tracks[].key_signals → badge chips
action_pathway      → steps list (candidate)
suggested_actions   → options list (institution)
legal_frameworks_applicable → tag chips (institution)
xai_rationale       → collapsible full explanation
free_expression_note → warning text if flagged
```
