import React, { useState, useEffect } from 'react';
import CandidateFlow from './CandidateFlow';
import InstitutionDashboard from './InstitutionDashboard';
import { auth, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './index.css'; 

export default function App() {
  const [currentRole, setCurrentRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Determine strict role context based on the URL parameter
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'institution' || view === 'candidate') {
      setCurrentRole(view);
    } else {
      // Fallback if accessed directly without params
      window.location.href = '/home.html';
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    await logOut();
    window.location.href = '/home.html';
  };

  if (!currentRole) return null;

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '60px', alignItems: 'center' }}>
         <h2 style={{ cursor: 'pointer', margin: 0 }} onClick={() => window.location.href = '/home.html'}>
          <span style={{ color: 'var(--primary-orange)' }}>S</span> SafeRoute
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Contextual Badge */}
          <span className="tag" style={{ background: 'var(--dark-blue)', color: 'white' }}>
            {currentRole === 'candidate' ? 'Candidate Portal' : 'Institution Portal'}
          </span>

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '16px', borderLeft: '2px solid rgba(0,0,0,0.1)', paddingLeft: '16px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>{currentUser.email}</span>
              <button className="btn-outline" onClick={handleSignOut} style={{ padding: '8px 16px', fontSize: '13px' }}>Sign Out</button>
            </div>
          )}
        </div>
      </nav>
      
      {currentRole === 'candidate' && <CandidateFlow user={currentUser} />}
      {currentRole === 'institution' && <InstitutionDashboard user={currentUser} />}
    </div>
  );
}