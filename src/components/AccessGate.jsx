import React, { useState, useEffect } from 'react';
import { getActiveBuildings } from '../../v2_definitive/src/buildings.js';

export const ROLE_OPTIONS = [
  { id: 'don', label: 'Director of Nursing (DON)', needsBuilding: true },
  { id: 'mds', label: 'MDS Coordinator', needsBuilding: true },
  { id: 'billing', label: 'Billing & RCM', needsBuilding: false },
  { id: 'admin', label: 'Facility Administrator', needsBuilding: true },
  { id: 'regional', label: 'Regional Operations', needsBuilding: false },
];

export function getUserAccess(userName, selectedRole, selectedBuildings) {
  const nameLower = (userName || '').toLowerCase().trim();

  if (nameLower === 'dov' || nameLower === 'dov braun' || nameLower.includes('dbraun')) {
    return {
      allowedRoles: ['mds', 'don', 'billing', 'admin', 'regional'],
      allowedBuildings: null,
    };
  }

  if (selectedRole === 'regional') {
    return {
      allowedRoles: ['mds', 'don', 'admin', 'regional'],
      allowedBuildings: null,
    };
  }

  if (selectedRole === 'billing') {
    return {
      allowedRoles: ['billing'],
      allowedBuildings: null,
    };
  }

  return {
    allowedRoles: [selectedRole],
    allowedBuildings: selectedBuildings.length > 0 ? selectedBuildings : null,
  };
}

export default function AccessGate({ onAuthenticated }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  const activeBuildings = getActiveBuildings();
  const currentRoleOption = ROLE_OPTIONS.find(r => r.id === selectedRole);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('ihcm_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.userName && session.allowedRoles && session.sessionToken) {
          onAuthenticated(session);
          return;
        }
        sessionStorage.removeItem('ihcm_session');
      }
    } catch (err) {
      console.warn('[IHCM] Session recovery failed:', err);
    }
    setChecking(false);
  }, []);

  const toggleBuilding = (buildingId) => {
    setSelectedBuildings(prev =>
      prev.includes(buildingId)
        ? prev.filter(b => b !== buildingId)
        : [...prev, buildingId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!code.trim()) { setError('Please enter the access code'); return; }
    if (!selectedRole) { setError('Please select your role'); return; }
    if (currentRoleOption?.needsBuilding && selectedBuildings.length === 0) {
      setError('Please select your building(s)');
      return;
    }

    try {
      const res = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        const access = getUserAccess(name.trim(), selectedRole, selectedBuildings);
        const session = {
          userName: name.trim(),
          selectedRole,
          sessionToken: data.sessionToken,
          ...access,
        };
        sessionStorage.setItem('ihcm_session', JSON.stringify(session));
        onAuthenticated(session);
      } else {
        setError('Invalid access code');
      }
    } catch {
      setError('Connection error — try again');
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '15px', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f9fafb'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white', padding: '36px', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '400px', textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '600', color: '#1f2937' }}>
          IHCM AI Bot
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
          Sign in to get started
        </p>

        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name" autoFocus style={inputStyle} />
        <input type="password" value={code} onChange={e => setCode(e.target.value)}
          placeholder="Access code" style={inputStyle} />

        <div style={{ textAlign: 'left', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            Your role
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ROLE_OPTIONS.map(role => (
              <label key={role.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                border: selectedRole === role.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                backgroundColor: selectedRole === role.id ? '#eff6ff' : 'white',
              }}>
                <input type="radio" name="role" value={role.id}
                  checked={selectedRole === role.id}
                  onChange={() => { setSelectedRole(role.id); setSelectedBuildings([]); }}
                  style={{ accentColor: '#2563eb' }} />
                {role.label}
              </label>
            ))}
          </div>
        </div>

        {currentRoleOption?.needsBuilding && (
          <div style={{ textAlign: 'left', marginBottom: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
              Your building(s)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {activeBuildings.map(b => (
                <label key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  border: selectedBuildings.includes(b.id) ? '2px solid #2563eb' : '1px solid #d1d5db',
                  backgroundColor: selectedBuildings.includes(b.id) ? '#eff6ff' : 'white',
                }}>
                  <input type="checkbox" checked={selectedBuildings.includes(b.id)}
                    onChange={() => toggleBuilding(b.id)} style={{ accentColor: '#2563eb' }} />
                  {b.shortName || b.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px 0' }}>{error}</p>}
        <button type="submit" style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          backgroundColor: '#2563eb', color: 'white', fontSize: '15px',
          fontWeight: '600', cursor: 'pointer'
        }}>
          Enter
        </button>
      </form>
    </div>
  );
}
