import React, { useState, useEffect } from 'react';
import { db, storage, logInWithGoogle } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useSafeRouteAnalysis } from './useSafeRouteAnalysis'; 
import AiAnalysisPanel from './AiAnalysisPanel'; 

export default function CandidateFlow({ user }) {
  const [activeTab, setActiveTab] = useState('submit'); 
  const [formData, setFormData] = useState({ 
    targetName: '', 
    platform: 'Twitter/X', 
    otherPlatform: '', 
    incidentDate: '', 
    urlLinks: '',
    description: '' 
  });
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle'); 
  const [myCases, setMyCases] = useState([]);

  // AI Hook Integration
  const { analyze, analyzeImage, loading, error } = useSafeRouteAnalysis(); 
  const [aiResult, setAiResult] = useState(null); 
  const [ocrText, setOcrText] = useState(''); 

  // Fetch candidate's past cases
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cases'), where('submittedBy', '==', user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const caseData = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      caseData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMyCases(caseData);
    });
    return () => unsubscribe();
  }, [user]);

  // Image upload OCR handling
  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files);
    setFiles(selected);
    
    // Run OCR on the first image immediately
    const imageFiles = selected.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      const imgResult = await analyzeImage(imageFiles[0], 'candidate', formData.description);
      if (imgResult?.suggested_description && !formData.description) {
        setFormData(prev => ({ ...prev, description: imgResult.suggested_description }));
      }
      setOcrText(imgResult?.ocr_text || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert("Please sign in first.");
    setStatus('uploading');

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const fileRef = ref(storage, `evidence/${user.uid}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        uploadedUrls.push({ name: file.name, url });
      }

      setStatus('analyzing');

      const finalPlatform = formData.platform === 'Other' && formData.otherPlatform.trim() !== '' 
        ? formData.otherPlatform 
        : formData.platform;

      // 1. Create the initial Firestore document
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

      // 2. Call the Real AI API
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

      // 3. Update Firestore with AI fields
      if (result) {
        setAiResult(result);
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
      setFiles([]);
      setFormData({ targetName: '', platform: 'Twitter/X', otherPlatform: '', incidentDate: '', urlLinks: '', description: '' });
      setOcrText('');
      
    } catch (err) {
      console.error("Error submitting case:", err);
      setStatus('idle');
      alert("Failed to submit. Check console.");
    }
  };

  // --- DELETE CASE FUNCTION ---
  const handleDeleteCase = async (id) => {
    if (window.confirm("Are you sure you want to completely delete this case? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'cases', id));
      } catch (error) {
        console.error("Error deleting case:", error);
        alert("Failed to delete case.");
      }
    }
  };

  if (!user) {
    return (
      <div className="card-base" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '16px' }}>Secure Identity Verification</h2>
        <p style={{ color: 'var(--brown)', marginBottom: '32px' }}>Please log in securely to access your tracking dashboard and submit official reports.</p>
        <button className="btn-solid" onClick={logInWithGoogle}>Log in with Google</button>
      </div>
    );
  }

  if (status === 'uploading' || status === 'analyzing') {
    return (
      <div className="card-base" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto', padding: '80px 40px' }}>
        <h2 style={{ marginBottom: '16px' }}>{status === 'uploading' ? 'Encrypting Evidence...' : 'AI Analyzing Context...'}</h2>
        <p style={{ color: 'var(--brown)' }}>Please do not close this window.</p>
        {loading && <p style={{ marginTop: '16px', color: 'var(--primary-orange)' }}>Contacting Intelligence Engine...</p>}
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card-base" style={{ textAlign: 'center', padding: '60px 40px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Evidence Secured.</h2>
          <p style={{ color: 'var(--brown)', marginBottom: '32px' }}>Your case has been analyzed and routed to the proper institution.</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button className="btn-solid" onClick={() => { setStatus('idle'); setAiResult(null); }}>Submit Another</button>
            <button className="btn-outline" onClick={() => { setStatus('idle'); setAiResult(null); setActiveTab('history'); }}>View My Cases</button>
          </div>
        </div>
        
        {/* Render the specific AI Analysis Panel for the candidate */}
        {aiResult && (
          <AiAnalysisPanel analysis={aiResult.analysis} role="candidate" />
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '2px solid rgba(28,46,84,0.1)', paddingBottom: '16px' }}>
        <button onClick={() => setActiveTab('submit')} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'submit' ? 'var(--primary-orange)' : 'var(--brown)' }}>Submit Evidence</button>
        <button onClick={() => setActiveTab('history')} style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'history' ? 'var(--primary-orange)' : 'var(--brown)' }}>My Past Cases</button>
      </div>

      {error && (
        <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '24px' }}>
          Error communicating with AI engine. Please try again.
        </div>
      )}

      {activeTab === 'submit' && (
        <form className="card-base" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>Targeted Candidate Name</label>
              <input type="text" className="input-field" required value={formData.targetName} onChange={(e) => setFormData({...formData, targetName: e.target.value})} placeholder="e.g. Jane Doe" />
            </div>
            <div className="input-group">
              <label>Platform / Medium</label>
              <select className="input-field" value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})}>
                <option>Twitter/X</option>
                <option>Facebook</option>
                <option>TikTok</option>
                <option>News Article / Blog</option>
                <option>Direct Message / Email</option>
                <option>Other</option>
              </select>
              {formData.platform === 'Other' && (
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Please specify platform" 
                  style={{ marginTop: '8px' }}
                  required 
                  value={formData.otherPlatform} 
                  onChange={(e) => setFormData({...formData, otherPlatform: e.target.value})} 
                />
              )}
            </div>
          </div>
          
          <div className="input-group">
            <label>Date of Incident</label>
            <input type="date" className="input-field" required value={formData.incidentDate} onChange={(e) => setFormData({...formData, incidentDate: e.target.value})} />
          </div>

          <div className="input-group">
            <label>Upload Media (Screenshots, Video, Audio, PDFs)</label>
            <div className="upload-area">
              <input type="file" multiple accept="image/*,video/*,audio/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} id="file-upload" />
              <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📁</span>
                <strong>Click to upload</strong> evidence<br/>
                <span style={{ fontSize: '12px', color: 'var(--brown)', fontWeight: 'normal' }}>Supports JPG, PNG, MP4, MP3, WAV, PDF</span>
              </label>
            </div>
            {files.length > 0 && <p style={{ fontSize: '13px', color: 'var(--primary-orange)', fontWeight: 'bold' }}>{files.length} file(s) selected</p>}
            {ocrText && <p style={{ fontSize: '11px', color: 'var(--brown)', marginTop: '8px' }}>✓ Image text successfully analyzed by Intelligence Engine</p>}
          </div>

          <div className="input-group">
            <label>Description of Incident (Optional)</label>
            <textarea 
              className="input-field" 
              rows="4" 
              placeholder="Provide any additional context or details here..." 
              style={{ resize: 'vertical' }}
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
            />
          </div>

          <div className="input-group">
            <label>Direct URLs (Optional)</label>
            <input type="url" className="input-field" value={formData.urlLinks} onChange={(e) => setFormData({...formData, urlLinks: e.target.value})} placeholder="https://..." />
          </div>

          <button type="submit" className="btn-solid" disabled={loading} style={{ width: '100%', marginTop: '16px' }}>
            {loading ? 'Processing...' : 'Analyze & Route Evidence'}
          </button>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="card-base" style={{ padding: '0', overflow: 'hidden' }}>
          {myCases.length === 0 ? (
            <p style={{ padding: '40px', textAlign: 'center', color: 'var(--brown)' }}>You have no submitted cases.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(28,46,84,0.03)', borderBottom: '2px solid rgba(28,46,84,0.05)' }}>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--brown)' }}>CASE ID</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--brown)' }}>DETAILS</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--brown)' }}>STATUS</th>
                  <th style={{ padding: '20px', fontSize: '13px', color: 'var(--brown)' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {myCases.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(28,46,84,0.05)' }}>
                    <td style={{ padding: '20px', fontSize: '14px', fontWeight: 'bold' }}>{c.id.slice(0,8).toUpperCase()}</td>
                    <td style={{ padding: '20px' }}><strong>{c.platform}</strong> <br/><span style={{fontSize: '13px', color: 'var(--brown)'}}>{c.incidentDate}</span></td>
                    <td style={{ padding: '20px' }}><span className={`tag ${c.status === 'Pending Review' ? 'tag-pending' : 'tag-review'}`}>{c.status}</span></td>
                    <td style={{ padding: '20px' }}>
                      <button 
                        onClick={() => handleDeleteCase(c.id)} 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}