import { useState } from 'react';

const AVOIDABILITY_COLORS = {
  avoidable: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'AVOIDABLE' },
  possibly_avoidable: { bg: '#fefce8', border: '#fde047', text: '#854d0e', label: 'POSSIBLY AVOIDABLE' },
  unavoidable: { bg: '#f0fdf4', border: '#86efac', text: '#166534', label: 'UNAVOIDABLE' },
};

export default function HospitalizationResult({ result, onConfirm, authHeaders }) {
  const [finalChoice, setFinalChoice] = useState(result.ai_avoidability || '');
  const [overrideReason, setOverrideReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const aiColors = AVOIDABILITY_COLORS[result.ai_avoidability] || AVOIDABILITY_COLORS.unavoidable;
  const isOverride = finalChoice !== result.ai_avoidability;

  const handleConfirm = async () => {
    if (!finalChoice) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/hospitalization-review', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          reviewId: result.review_id,
          finalAvoidability: finalChoice,
          overrideReason: isOverride ? overrideReason : null,
        }),
      });
      if (res.ok) {
        setConfirmed(true);
        if (onConfirm) onConfirm(finalChoice);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save determination');
      }
    } catch {
      alert('Failed to save — check connection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb',
      padding: '16px', margin: '8px 0',
    }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
        Hospitalization Avoidability Analysis
      </div>

      {/* AI Classification */}
      {result.ai_avoidability && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
          backgroundColor: aiColors.bg, border: `1px solid ${aiColors.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', backgroundColor: aiColors.text, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              AI: {aiColors.label}
            </span>
          </div>
          {result.ai_reasoning && (
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{result.ai_reasoning}</div>
          )}
        </div>
      )}

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '13px' }}>
        {result.ai_root_causes?.length > 0 && (
          <div>
            <div style={{ fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Root Causes</div>
            <div style={{ color: '#374151' }}>{result.ai_root_causes.join(', ')}</div>
          </div>
        )}
        {result.ai_interact_pathway && (
          <div>
            <div style={{ fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>INTERACT Pathway</div>
            <div style={{ color: '#374151' }}>{result.ai_interact_pathway}</div>
          </div>
        )}
      </div>

      {result.ai_prevention && (
        <div style={{ fontSize: '13px', color: '#166534', backgroundColor: '#f0fdf4', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', lineHeight: '1.5' }}>
          <strong>Prevention:</strong> {result.ai_prevention}
        </div>
      )}

      {result.ai_qi_actions?.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: '600', color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>QI Actions</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#374151', lineHeight: '1.6' }}>
            {result.ai_qi_actions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Confirmation / Override */}
      {!confirmed ? (
        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '4px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
            Confirm or Override Classification
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {Object.entries(AVOIDABILITY_COLORS).map(([key, c]) => (
              <button
                key={key}
                onClick={() => setFinalChoice(key)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  border: finalChoice === key ? `2px solid ${c.text}` : '1px solid #d1d5db',
                  backgroundColor: finalChoice === key ? c.bg : 'white',
                  color: finalChoice === key ? c.text : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          {isOverride && (
            <input
              type="text"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Reason for override (no PHI)..."
              style={{
                width: '100%', padding: '6px 10px', borderRadius: '6px',
                border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit',
                marginBottom: '8px', boxSizing: 'border-box',
              }}
            />
          )}
          <button
            onClick={handleConfirm}
            disabled={!finalChoice || submitting}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none',
              backgroundColor: finalChoice ? '#2563eb' : '#d1d5db',
              color: 'white', cursor: finalChoice ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: '600',
            }}
          >
            {submitting ? 'Saving...' : isOverride ? 'Override & Save' : 'Confirm Classification'}
          </button>
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '4px',
          fontSize: '13px', color: '#166534', fontWeight: '500',
        }}>
          Classification confirmed: {AVOIDABILITY_COLORS[finalChoice]?.label || finalChoice}
          {isOverride && overrideReason && <span style={{ color: '#6b7280' }}> — {overrideReason}</span>}
        </div>
      )}
    </div>
  );
}
