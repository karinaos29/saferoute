import React, { useState, useEffect } from 'react';
import { db, logInWithGoogle } from './firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { useSafeRouteAnalysis } from './useSafeRouteAnalysis'; 
import AiAnalysisPanel from './AiAnalysisPanel'; 

export default function InstitutionDashboard({ user }) {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const caseData = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      setCases(caseData);
      // If a case is currently open, update its live data
      if (selectedCase) {
        const updatedSelected = caseData.find(c => c.id === selectedCase.id);
        if (updatedSelected) setSelectedCase(updatedSelected);
      }
    });
    return () => unsubscribe();
  }, [user, selectedCase]);

  // Fallback manual status update (if needed outside of AI review gate)
  const updateCaseStatus = async (id, newStatus) => {
    const caseRef = doc(db, 'cases', id);
    await updateDoc(caseRef, { status: newStatus });
  };

  // --- DELETE CASE FUNCTION ---
  const handleDeleteCase = async (id) => {
    if (window.confirm("Are you sure you want to completely remove this case from the database? This action is permanent and cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'cases', id));
        if (selectedCase && selectedCase.id === id) {
          setSelectedCase(null); // Close the detail view if they deleted the currently open case
        }
      } catch (error) {
        console.error("Error deleting case:", error);
        alert("Failed to delete case.");
      }
    }
  };

  if (!user) {
    return (
      <div className="card-base" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <div className="eyebrow">Institution Portal</div>
        <h2 style={{ marginBottom: '16px' }}>Dashboard Login</h2>
        <p style={{ color: 'var(--brown)', marginBottom: '32px' }}>Authorized institution accounts only.</p>
        <button className="btn-solid" onClick={logInWithGoogle}>Log in with Google</button>
      </div>
    );
  }

  // --- FULL CASE DETAILED VIEW ---
  if (selectedCase) {
    return (
      <div className="card-base">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: 'var(--brown)', cursor: 'pointer', fontWeight: 'bold' }}>
            ← Back to Dashboard
          </button>
          <button onClick={() => handleDeleteCase(selectedCase.id)} style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', padding: '6px 16px', borderRadius: '8px' }}>
            Delete Case
          </button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <div className="eyebrow">Case Dossier {selectedCase.id.slice(0,8).toUpperCase()}</div>
            <h2 style={{ margin: 0 }}>Target: {selectedCase.targetName}</h2>
            <p style={{ color: 'var(--brown)', marginTop: '8px' }}>Submitted by: {selectedCase.submittedBy}</p>
          </div>
          <span className={`tag ${selectedCase.status === 'Pending Review' ? 'tag-pending' : 'tag-review'}`} style={{ fontSize: '14px', padding: '10px 16px' }}>
            {selectedCase.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }}>
          <div style={{ background: 'rgba(28,46,84,0.03)', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--primary-orange)' }}>Incident Details</h3>
            <p><strong>Platform:</strong> {selectedCase.platform}</p>
            <p style={{ marginTop: '8px' }}><strong>Date:</strong> {selectedCase.incidentDate}</p>
            <p style={{ marginTop: '8px' }}><strong>Description:</strong> {selectedCase.description || 'None provided'}</p>
            <p style={{ marginTop: '8px' }}><strong>Attached URL:</strong> {selectedCase.urlLinks ? <a href={selectedCase.urlLinks} target="_blank" rel="noreferrer">{selectedCase.urlLinks}</a> : 'None provided'}</p>
          </div>
          
          <div style={{ background: '#f2effc', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#3C3489' }}>AI High-Level Summary</h3>
            <p><strong>Identified Framework:</strong> {selectedCase.aiCategory || 'Uncategorised'}</p>
            <p style={{ marginTop: '8px' }}><strong>Risk Severity:</strong> {selectedCase.severity || 'Pending'}</p>
            <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--brown)' }}>* Expand the Intelligence Panel below for XAI rationale and confidence metrics.</p>
          </div>
        </div>

        {/* AI Analysis Panel Integration */}
        {selectedCase.aiAnalysis && (
          <div style={{ marginBottom: '40px' }}>
            <AiAnalysisPanel 
              analysis={selectedCase.aiAnalysis} 
              role="institution" 
            />
          </div>
        )}

        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Attached Evidence Files</h3>
        {selectedCase.evidenceFiles && selectedCase.evidenceFiles.length > 0 ? (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
            {selectedCase.evidenceFiles.map((file, i) => (
              <li key={i} style={{ padding: '16px', border: '1px solid rgba(28,46,84,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <strong>{file.name}</strong>
                <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-orange)', fontWeight: 'bold', textDecoration: 'none' }}>View File ↗</a>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--brown)', marginBottom: '40px' }}>No files were attached to this report.</p>
        )}

        {/* Human Review Gate Integration */}
        <HumanReviewGate 
          caseId={selectedCase.id}
          reviewerEmail={user.email}
          currentStatus={selectedCase.status}
        />
      </div>
    );
  }

  // --- STANDARD TABLE VIEW ---
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <div className="eyebrow">Secure Portal</div>
          <h2>Case Management Dashboard</h2>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="card-base" style={{ padding: '16px 24px', minWidth: '150px' }}>
            <h3 style={{ fontSize: '32px', color: 'var(--primary-orange)' }}>
              {cases.filter(c => c.status === 'Pending Review').length}
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--brown)' }}>CASES PENDING</span>
          </div>
        </div>
      </div>

      <div className="card-base" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(28,46,84,0.03)', borderBottom: '2px solid rgba(28,46,84,0.05)' }}>
              <th style={{ padding: '24px', fontSize: '13px', color: 'var(--brown)' }}>TARGET / PLATFORM</th>
              <th style={{ padding: '24px', fontSize: '13px', color: 'var(--brown)' }}>DATE / FILES</th>
              <th style={{ padding: '24px', fontSize: '13px', color: 'var(--brown)' }}>AI TAG</th>
              <th style={{ padding: '24px', fontSize: '13px', color: 'var(--brown)' }}>STATUS</th>
              <th style={{ padding: '24px', fontSize: '13px', color: 'var(--brown)' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--brown)' }}>No cases reported yet.</td></tr>
            )}
            {cases.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(28,46,84,0.05)' }}>
                <td style={{ padding: '24px' }}><strong>{c.targetName}</strong><br/><span style={{fontSize: '13px', color: 'var(--brown)'}}>{c.platform}</span></td>
                <td style={{ padding: '24px', fontSize: '14px' }}>{c.incidentDate}<br/><span style={{fontSize: '12px', color: 'var(--primary-orange)'}}>{c.evidenceFiles?.length || 0} Attached files</span></td>
                <td style={{ padding: '24px' }}>
                  <span className={`tag ${c.aiCategory?.includes('OGBV') ? 'tag-ogbv' : 'tag-hate'}`}>
                    {c.aiCategory || 'Uncategorised'}
                  </span>
                </td>
                <td style={{ padding: '24px' }}>
                  <span className={`tag ${c.status === 'Pending Review' ? 'tag-pending' : 'tag-review'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: '24px', display: 'flex', gap: '8px' }}>
                  <button className="btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setSelectedCase(c)}>
                    View
                  </button>
                  <button 
                    onClick={() => handleDeleteCase(c.id)} 
                    style={{ padding: '8px 16px', fontSize: '13px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- HUMAN REVIEW GATE COMPONENT ---
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
    <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #86efac', marginTop: '24px' }}>
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