import { useState, useEffect } from 'react';
import BuildingDetail from './BuildingDetail';

// Feature flag — set to true to show hospitalization data on dashboard
const SHOW_HOSPITALIZATIONS = false;

export const RISK_COLORS = {
  critical: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'CRITICAL' },
  high_risk: { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', label: 'HIGH RISK' },
  watch: { bg: '#fefce8', border: '#fde047', text: '#854d0e', label: 'WATCH' },
  stable: { bg: '#f0fdf4', border: '#86efac', text: '#166534', label: 'STABLE' },
};

export default function Dashboard({ authHeaders, onSelectBuilding }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [hospStats, setHospStats] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard', { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setData(json);

        // Load hospitalization stats if feature enabled
        if (SHOW_HOSPITALIZATIONS) {
          try {
            const hospRes = await fetch('/api/hospitalization-review?mode=stats', { headers: authHeaders() });
            if (hospRes.ok) setHospStats(await hospRes.json());
          } catch { /* non-blocking */ }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading portfolio...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>Error: {error}</div>;
  if (!data) return null;

  const { buildings, totals } = data;

  if (selectedSlug) {
    const building = buildings.find(b => b.slug === selectedSlug);
    if (building) {
      return (
        <BuildingDetail
          building={building}
          onBack={() => setSelectedSlug(null)}
          onChat={(slug) => onSelectBuilding(slug)}
        />
      );
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Portfolio Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <SummaryCard label="Total Census" value={totals.total_census} sub={`/ ${totals.total_beds} beds`} />
        <SummaryCard label="Occupancy" value={`${totals.occupancy_pct}%`} sub={`${totals.total_gap} empty beds`} />
        {(() => {
          const weighted = buildings.reduce((s, b) => s + (b.skilled_mix_pct || 0) * (b.census || 0), 0);
          const totalCensus = buildings.reduce((s, b) => s + (b.census || 0), 0);
          const portfolioMix = totalCensus > 0 ? Math.round((weighted / totalCensus) * 10) / 10 : 0;
          return <SummaryCard label="Skilled Mix" value={`${portfolioMix}%`} sub="portfolio avg" color={portfolioMix >= 20 ? '#166534' : portfolioMix >= 10 ? '#d97706' : '#dc2626'} />;
        })()}
        <SummaryCard label="Buildings" value={buildings.length} sub={`${totals.buildings_at_risk} at risk`} color={totals.buildings_at_risk > 0 ? '#dc2626' : '#166534'} />
        <SummaryCard label="Open Alerts" value={totals.total_alerts} sub={`${totals.buildings_watch} on watch`} color={totals.total_alerts > 3 ? '#dc2626' : '#6b7280'} />
        {SHOW_HOSPITALIZATIONS && hospStats && (
          <SummaryCard
            label="Hospitalizations"
            value={hospStats.total}
            sub={hospStats.avoidable_pct != null ? `${hospStats.avoidable_pct}% avoidable` : `${hospStats.pending} pending`}
            color={hospStats.avoidable_pct > 30 ? '#dc2626' : hospStats.avoidable_pct > 15 ? '#d97706' : '#166534'}
          />
        )}
      </div>

      {/* Building Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {buildings.map(b => {
          const risk = RISK_COLORS[b.risk_label] || RISK_COLORS.stable;
          const occupancyPct = b.bed_capacity > 0 ? Math.round((b.census / b.bed_capacity) * 100) : 0;

          return (
            <div key={b.slug}
              onClick={() => setSelectedSlug(b.slug)}
              style={{
                backgroundColor: 'white', borderRadius: '10px',
                border: `2px solid ${risk.border}`, padding: '16px',
                cursor: 'pointer', transition: 'box-shadow 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>{b.label}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{b.state}</div>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
                  backgroundColor: risk.bg, color: risk.text, border: `1px solid ${risk.border}`,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {risk.label}
                </span>
              </div>

              {/* Metrics Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <Metric label="Census" value={b.census || 0} sub={`/ ${b.bed_capacity || '?'}`} />
                <Metric label="Occupancy" value={`${occupancyPct}%`} color={occupancyPct < 70 ? '#dc2626' : occupancyPct < 85 ? '#d97706' : '#166534'} />
                <Metric label="Skilled Mix" value={b.skilled_mix_pct != null ? `${b.skilled_mix_pct}%` : '—'} color={b.skilled_mix_pct >= 20 ? '#166534' : b.skilled_mix_pct >= 10 ? '#d97706' : '#dc2626'} />
                <Metric label="Risk Score" value={b.composite_score || '—'} color={risk.text} />
              </div>

              {/* Occupancy Bar */}
              <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${Math.min(occupancyPct, 100)}%`,
                  backgroundColor: occupancyPct < 70 ? '#ef4444' : occupancyPct < 85 ? '#f59e0b' : '#22c55e',
                  transition: 'width 0.3s',
                }} />
              </div>

              {/* Key Context */}
              {b.risk_watchlist && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '6px', lineHeight: '1.4' }}>
                  {b.risk_watchlist}
                </div>
              )}
              {b.strategic_notes && (
                <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {b.strategic_notes}
                </div>
              )}

              {/* Top Alert */}
              {b.top_alert && (
                <div style={{
                  marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
                  backgroundColor: b.top_alert.severity === 'critical' ? '#fef2f2' : '#fffbeb',
                  fontSize: '12px', color: b.top_alert.severity === 'critical' ? '#991b1b' : '#92400e',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '10px' }}>{b.top_alert.severity}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.top_alert.title}</span>
                </div>
              )}

              {/* Alert count badge */}
              {b.alert_count > 0 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280' }}>
                  {b.alert_count} open alert{b.alert_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '8px', padding: '14px 16px',
      border: '1px solid #e5e7eb', textAlign: 'center',
    }}>
      <div style={{ fontSize: '24px', fontWeight: '700', color: color || '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginTop: '2px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: '700', color: color || '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}
