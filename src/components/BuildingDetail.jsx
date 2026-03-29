import { useState } from 'react';
import { RISK_COLORS } from './Dashboard';

const SEVERITY_COLORS = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  high:     { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  medium:   { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
  low:      { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
};

export default function BuildingDetail({ building, onBack, onChat }) {
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const b = building;
  const risk = RISK_COLORS[b.risk_label] || RISK_COLORS.stable;
  const occupancyPct = b.bed_capacity > 0 ? Math.round((b.census / b.bed_capacity) * 100) : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid #d1d5db', borderRadius: '6px',
            padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: '#374151',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ← Back to Portfolio
        </button>
        <button
          onClick={() => onChat(b.slug)}
          style={{
            background: '#2563eb', border: 'none', borderRadius: '6px',
            padding: '8px 16px', cursor: 'pointer', fontSize: '13px', color: 'white',
            fontWeight: '600',
          }}
        >
          Chat about {b.label} →
        </button>
      </div>

      {/* Building Header */}
      <div style={{
        backgroundColor: 'white', borderRadius: '10px', border: `2px solid ${risk.border}`,
        padding: '20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1f2937' }}>{b.label}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{b.state}</div>
          </div>
          <span style={{
            fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px',
            backgroundColor: risk.bg, color: risk.text, border: `1px solid ${risk.border}`,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {risk.label}
          </span>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <MetricBox label="Census" value={b.census || 0} sub={`/ ${b.bed_capacity || '?'} beds`} />
          <MetricBox label="Occupancy" value={`${occupancyPct}%`} color={occupancyPct < 70 ? '#dc2626' : occupancyPct < 85 ? '#d97706' : '#166534'} />
          <MetricBox label="Risk Score" value={b.composite_score || '—'} color={risk.text} />
        </div>

        {/* Occupancy Bar */}
        <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '4px',
            width: `${Math.min(occupancyPct, 100)}%`,
            backgroundColor: occupancyPct < 70 ? '#ef4444' : occupancyPct < 85 ? '#f59e0b' : '#22c55e',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Risk & Strategy */}
      {(b.risk_watchlist || b.strategic_notes) && (
        <Section title="Risk & Strategy">
          {b.risk_watchlist && (
            <ContextRow label="Risk Watchlist" value={b.risk_watchlist} color="#dc2626" />
          )}
          {b.strategic_notes && (
            <ContextRow label="Strategic Notes" value={b.strategic_notes} />
          )}
        </Section>
      )}

      {/* Building Context */}
      {(b.payer_context || b.market_summary || b.referral_summary) && (
        <Section title="Building Context">
          {b.payer_context && <ContextRow label="Payer Mix" value={b.payer_context} />}
          {b.market_summary && <ContextRow label="Market" value={b.market_summary} />}
          {b.referral_summary && <ContextRow label="Referrals" value={b.referral_summary} />}
        </Section>
      )}

      {/* Operations */}
      {(b.survey_context || b.staffing_context || b.reimbursement_context) && (
        <Section title="Operations">
          {b.survey_context && <ContextRow label="Survey" value={b.survey_context} />}
          {b.staffing_context && <ContextRow label="Staffing" value={b.staffing_context} />}
          {b.reimbursement_context && <ContextRow label="Reimbursement" value={b.reimbursement_context} />}
        </Section>
      )}

      {/* Growth */}
      {(b.growth_barriers?.length > 0 || b.growth_opportunities?.length > 0) && (
        <Section title="Growth">
          {b.growth_barriers?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>Barriers</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4b5563', lineHeight: '1.6' }}>
                {b.growth_barriers.map((item, i) => <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}
              </ul>
            </div>
          )}
          {b.growth_opportunities?.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>Opportunities</div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4b5563', lineHeight: '1.6' }}>
                {b.growth_opportunities.map((item, i) => <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Open Alerts */}
      <Section title={`Open Alerts (${b.alert_count || 0})`}>
        {(!b.alerts || b.alerts.length === 0) ? (
          <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No open alerts</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {b.alerts.map((alert) => {
              const sev = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.medium;
              const isExpanded = expandedAlertId === alert.alert_id;
              return (
                <div
                  key={alert.alert_id}
                  onClick={() => setExpandedAlertId(isExpanded ? null : alert.alert_id)}
                  style={{
                    border: `1px solid ${sev.border}`, borderRadius: '8px',
                    backgroundColor: sev.bg, cursor: 'pointer',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  {/* Alert Header */}
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: '3px',
                      backgroundColor: sev.text, color: 'white',
                      letterSpacing: '0.05em', flexShrink: 0,
                    }}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#1f2937', flex: 1 }}>
                      {alert.title}
                    </span>
                    {alert.alert_date && (
                      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                        {new Date(alert.alert_date).toLocaleDateString()}
                      </span>
                    )}
                    <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 14px 12px 14px',
                      borderTop: `1px solid ${sev.border}`,
                      paddingTop: '10px',
                    }}>
                      {alert.description && (
                        <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', marginBottom: '8px' }}>
                          {alert.description}
                        </div>
                      )}
                      {alert.recommended_action && (
                        <div style={{
                          fontSize: '13px', color: '#166534', lineHeight: '1.5',
                          backgroundColor: '#f0fdf4', padding: '8px 10px', borderRadius: '6px',
                          marginBottom: '8px',
                        }}>
                          <strong>Recommended:</strong> {alert.recommended_action}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6b7280' }}>
                        {alert.alert_category && <span>Category: <strong>{alert.alert_category}</strong></span>}
                        {alert.alert_type && <span>Type: <strong>{alert.alert_type}</strong></span>}
                        {alert.owner_role && <span>Owner: <strong>{alert.owner_role}</strong></span>}
                        {alert.status && <span>Status: <strong>{alert.status}</strong></span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb',
      padding: '16px 20px', marginBottom: '16px',
    }}>
      <div style={{
        fontSize: '13px', fontWeight: '700', color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ContextRow({ label, value, color }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: color || '#374151', lineHeight: '1.5' }}>
        {value}
      </div>
    </div>
  );
}

function MetricBox({ label, value, sub, color }) {
  return (
    <div style={{
      textAlign: 'center', backgroundColor: '#f9fafb', borderRadius: '6px', padding: '10px',
    }}>
      <div style={{ fontSize: '20px', fontWeight: '700', color: color || '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}
