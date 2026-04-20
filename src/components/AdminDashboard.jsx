import { useState, useEffect, useCallback } from 'react';

export default function AdminDashboard({ authHeaders, canReviewKnowledge = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionError, setActionError] = useState(null);
  const [pendingActionId, setPendingActionId] = useState(null);

  const fetchAdmin = useCallback(() => {
    return fetch('/api/admin', { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, [authHeaders]);

  useEffect(() => {
    fetchAdmin().finally(() => setLoading(false));
  }, [fetchAdmin]);

  const handleKnowledgeAction = async (sourceId, newStatus) => {
    setActionError(null);
    setPendingActionId(sourceId);
    try {
      const res = await fetch('/api/ingest-knowledge', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${newStatus === 'approved' ? 'approve' : 'archive'} (HTTP ${res.status})`);
      }
      await fetchAdmin();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPendingActionId(null);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading admin data...</div>;
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>Error: {error}</div>;
  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: `Users (${data.users?.length || 0})` },
    { id: 'conversations', label: `Conversations (${data.conversation_totals?.all_time || 0})` },
    { id: 'feedback', label: `Feedback (${data.feedback_summary?.total || 0})` },
    { id: 'knowledge', label: `Knowledge (${data.knowledge?.length || 0})` },
    { id: 'surveys', label: `Surveys (${data.recent_surveys?.length || 0})` },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600',
              border: activeTab === tab.id ? '2px solid #2563eb' : '1px solid #d1d5db',
              backgroundColor: activeTab === tab.id ? '#eff6ff' : 'white',
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'users' && <UsersTab users={data.users} />}
      {activeTab === 'conversations' && <ConversationsTab conversations={data.conversations} totals={data.conversation_totals} />}
      {activeTab === 'feedback' && <FeedbackTab feedback={data.feedback} summary={data.feedback_summary} />}
      {activeTab === 'knowledge' && (
        <KnowledgeTab
          knowledge={data.knowledge}
          summary={data.knowledge_summary}
          canReviewKnowledge={canReviewKnowledge}
          onAction={handleKnowledgeAction}
          pendingActionId={pendingActionId}
          actionError={actionError}
        />
      )}
      {activeTab === 'surveys' && <SurveysTab surveys={data.recent_surveys} authHeaders={authHeaders} />}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', fontWeight: '700', color: color || '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginTop: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function Table({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#4b5563', whiteSpace: 'nowrap' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '8px 12px', color: '#1f2937' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ text, color }) {
  const colors = {
    green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    yellow: { bg: '#fef3c7', text: '#92400e', border: '#fde047' },
    red: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    gray: { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
      backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
      textTransform: 'uppercase',
    }}>
      {text}
    </span>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Tab Components ──

function OverviewTab({ data }) {
  const { conversation_totals, feedback_summary, users, usage_by_role, knowledge_summary, activity_trend, feedback_trend, usage_by_building } = data;
  const activeUsers = users?.filter(u => u.last_active)?.length || 0;
  const usefulPct = feedback_summary?.total > 0
    ? Math.round((feedback_summary.useful / feedback_summary.total) * 100)
    : 0;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total Users" value={users?.length || 0} sub={`${activeUsers} active`} />
        <StatCard label="Conversations" value={conversation_totals?.all_time || 0} sub={`${conversation_totals?.last_7_days || 0} this week`} />
        <StatCard label="Feedback" value={feedback_summary?.total || 0} sub={`${usefulPct}% useful`} color={usefulPct >= 70 ? '#166534' : '#d97706'} />
        <StatCard label="Knowledge" value={knowledge_summary ? Object.values(knowledge_summary).reduce((a, b) => a + b, 0) : 0} sub={`${knowledge_summary?.draft || 0} drafts`} />
      </div>

      {/* Activity Trend (30 days) */}
      {activity_trend && activity_trend.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Conversations — Last 30 Days</h3>
          <BarChart data={activity_trend} valueKey="count" color="#2563eb" />
        </div>
      )}

      {/* Feedback Trend (30 days) */}
      {feedback_trend && feedback_trend.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Feedback — Last 30 Days</h3>
          <StackedBarChart data={feedback_trend} />
        </div>
      )}

      {/* Usage by Role + Building side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Usage by Role</h3>
          <HorizontalBar data={usage_by_role || {}} color="#2563eb" />
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Usage by Building</h3>
          <HorizontalBar data={usage_by_building || {}} color="#059669" />
        </div>
      </div>

      {/* Feedback Breakdown */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Feedback Breakdown</h3>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div><span style={{ fontSize: '20px', fontWeight: '700', color: '#166534' }}>{feedback_summary?.useful || 0}</span> <span style={{ fontSize: '12px', color: '#6b7280' }}>Useful</span></div>
          <div><span style={{ fontSize: '20px', fontWeight: '700', color: '#d97706' }}>{feedback_summary?.not_useful || 0}</span> <span style={{ fontSize: '12px', color: '#6b7280' }}>Not Useful</span></div>
          <div><span style={{ fontSize: '20px', fontWeight: '700', color: '#dc2626' }}>{feedback_summary?.questionable || 0}</span> <span style={{ fontSize: '12px', color: '#6b7280' }}>Wrong</span></div>
          <div><span style={{ fontSize: '20px', fontWeight: '700', color: '#6b7280' }}>{feedback_summary?.needs_review || 0}</span> <span style={{ fontSize: '12px', color: '#6b7280' }}>Needs Review</span></div>
        </div>
      </div>
    </>
  );
}

function UsersTab({ users }) {
  return (
    <Table
      columns={[
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'app_role', label: 'Role', render: v => <Badge text={v?.replace(/_/g, ' ')} color={v === 'super_admin' ? 'blue' : v === 'corporate_admin' ? 'green' : 'gray'} /> },
        { key: 'allowed_bot_roles', label: 'Bot Roles', render: v => (v || []).join(', ') },
        { key: 'is_active', label: 'Active', render: v => v ? 'Yes' : 'No' },
        { key: 'last_active', label: 'Last Active', render: v => timeAgo(v) },
      ]}
      rows={users || []}
    />
  );
}

function ConversationsTab({ conversations, totals }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="All Time" value={totals?.all_time || 0} />
        <StatCard label="This Week" value={totals?.last_7_days || 0} />
      </div>
      <Table
        columns={[
          { key: 'user_name', label: 'User' },
          { key: 'bot_id', label: 'Role', render: v => <Badge text={v || '?'} color="gray" /> },
          { key: 'facility_name', label: 'Building' },
          { key: 'title', label: 'Title', render: v => (v || '').slice(0, 60) },
          { key: 'message_count', label: 'Messages' },
          { key: 'created_at', label: 'Created', render: v => timeAgo(v) },
        ]}
        rows={conversations || []}
      />
    </>
  );
}

function FeedbackTab({ feedback, summary }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="Useful" value={summary?.useful || 0} color="#166534" />
        <StatCard label="Not Useful" value={summary?.not_useful || 0} color="#d97706" />
        <StatCard label="Wrong" value={summary?.questionable || 0} color="#dc2626" />
        <StatCard label="Total" value={summary?.total || 0} />
      </div>
      <Table
        columns={[
          { key: 'user_name', label: 'User' },
          { key: 'rating', label: 'Rating', render: v => <Badge text={v} color={v === 'useful' ? 'green' : v === 'questionable' ? 'red' : 'yellow'} /> },
          { key: 'comment', label: 'Context', render: v => (v || '').slice(0, 80) },
          { key: 'created_at', label: 'When', render: v => timeAgo(v) },
        ]}
        rows={feedback || []}
      />
    </>
  );
}

function KnowledgeTab({ knowledge, summary, canReviewKnowledge, onAction, pendingActionId, actionError }) {
  const columns = [
    { key: 'title', label: 'Title', render: v => (v || '').slice(0, 50) },
    { key: 'source_type', label: 'Type', render: v => <Badge text={v?.replace(/_/g, ' ')} color="gray" /> },
    { key: 'status', label: 'Status', render: v => <Badge text={v} color={v === 'approved' ? 'green' : v === 'draft' ? 'yellow' : 'gray'} /> },
    { key: 'state_code', label: 'State' },
    { key: 'facility_name', label: 'Building' },
    { key: 'current_version', label: 'Ver' },
    { key: 'updated_at', label: 'Updated', render: v => timeAgo(v) },
  ];

  if (canReviewKnowledge) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const isPending = pendingActionId === row.source_id;
        const canApprove = row.status === 'draft' || row.status === 'in_review';
        const canArchive = row.status !== 'archived';
        if (!canApprove && !canArchive) return <span style={{ color: '#9ca3af' }}>—</span>;
        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            {canApprove && (
              <button
                onClick={() => onAction(row.source_id, 'approved')}
                disabled={isPending}
                style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '12px',
                  border: '1px solid #16a34a', backgroundColor: isPending ? '#f3f4f6' : '#f0fdf4',
                  color: '#166534', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: '600',
                }}>
                {isPending ? '…' : 'Approve'}
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => onAction(row.source_id, 'archived')}
                disabled={isPending}
                style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '12px',
                  border: '1px solid #d1d5db', backgroundColor: 'white',
                  color: '#6b7280', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: '500',
                }}>
                Archive
              </button>
            )}
          </div>
        );
      },
    });
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="Approved" value={summary?.approved || 0} color="#166534" />
        <StatCard label="Drafts" value={summary?.draft || 0} color="#d97706" />
        <StatCard label="Archived" value={summary?.archived || 0} />
      </div>
      {actionError && (
        <div style={{
          padding: '8px 12px', marginBottom: '12px', borderRadius: '6px',
          backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px',
        }}>
          {actionError}
        </div>
      )}
      <Table columns={columns} rows={knowledge || []} />
    </>
  );
}

function SurveysTab({ surveys, authHeaders }) {
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState(null);

  const handlePullCms = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch('/api/cron-cms-surveys', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pull failed');
      const totalSurveys = data.results?.reduce((s, r) => s + r.surveys, 0) || 0;
      const totalDefs = data.results?.reduce((s, r) => s + r.deficiencies, 0) || 0;
      setPullResult(`Pulled ${totalDefs} deficiencies across ${totalSurveys} surveys for ${data.results?.length || 0} buildings`);
    } catch (err) {
      setPullResult(`Error: ${err.message}`);
    } finally {
      setPulling(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <button
          onClick={handlePullCms}
          disabled={pulling}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none',
            backgroundColor: pulling ? '#d1d5db' : '#2563eb', color: 'white',
            cursor: pulling ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600',
          }}
        >
          {pulling ? 'Pulling from CMS...' : 'Pull CMS Surveys Now'}
        </button>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          Auto-pulls monthly on the 1st at 6 AM UTC
        </span>
        {pullResult && (
          <span style={{ fontSize: '12px', color: pullResult.startsWith('Error') ? '#dc2626' : '#166534', fontWeight: '500' }}>
            {pullResult}
          </span>
        )}
      </div>
      <Table
        columns={[
          { key: 'facility_name', label: 'Building' },
          { key: 'survey_date', label: 'Survey Date' },
          { key: 'survey_type', label: 'Type', render: v => <Badge text={v} color={v === 'complaint' ? 'red' : 'gray'} /> },
          { key: 'source', label: 'Source', render: v => <Badge text={v} color={v === 'cms' ? 'blue' : v === 'uploaded_2567' ? 'green' : 'gray'} /> },
          { key: 'total_deficiencies', label: 'Deficiencies' },
          { key: 'has_immediate_jeopardy', label: 'IJ', render: v => v ? <Badge text="IJ" color="red" /> : '—' },
          { key: 'created_at', label: 'Ingested', render: v => timeAgo(v) },
        ]}
        rows={surveys || []}
      />
    </>
  );
}

// ── Chart Components (pure CSS, no dependencies) ──

function BarChart({ data, valueKey, color }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
          title={`${d.date}: ${d[valueKey]}`}
        >
          <div style={{
            width: '100%', maxWidth: '12px', borderRadius: '2px 2px 0 0',
            backgroundColor: d[valueKey] > 0 ? color : '#f3f4f6',
            height: `${Math.max((d[valueKey] / max) * 100, 2)}%`,
            minHeight: d[valueKey] > 0 ? '4px' : '2px',
            transition: 'height 0.2s',
          }} />
        </div>
      ))}
    </div>
  );
}

function StackedBarChart({ data }) {
  const max = Math.max(...data.map(d => d.useful + d.not_useful + d.questionable), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px' }}>
        {data.map((d, i) => {
          const total = d.useful + d.not_useful + d.questionable;
          const h = total > 0 ? (total / max) * 100 : 2;
          const usefulH = total > 0 ? (d.useful / total) * 100 : 0;
          const notUsefulH = total > 0 ? (d.not_useful / total) * 100 : 0;
          const wrongH = total > 0 ? (d.questionable / total) * 100 : 0;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}
              title={`${d.date}: ${d.useful} useful, ${d.not_useful} not useful, ${d.questionable} wrong`}
            >
              <div style={{ width: '100%', maxWidth: '12px', margin: '0 auto', height: `${Math.max(h, 2)}%`, display: 'flex', flexDirection: 'column', borderRadius: '2px 2px 0 0', overflow: 'hidden' }}>
                {wrongH > 0 && <div style={{ height: `${wrongH}%`, backgroundColor: '#dc2626' }} />}
                {notUsefulH > 0 && <div style={{ height: `${notUsefulH}%`, backgroundColor: '#d97706' }} />}
                {usefulH > 0 && <div style={{ height: `${usefulH}%`, backgroundColor: '#166534' }} />}
                {total === 0 && <div style={{ height: '100%', backgroundColor: '#f3f4f6' }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#166534', display: 'inline-block' }} /> Useful</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#d97706', display: 'inline-block' }} /> Not Useful</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#dc2626', display: 'inline-block' }} /> Wrong</span>
      </div>
    </div>
  );
}

function HorizontalBar({ data, color }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? entries[0][1] : 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {entries.map(([label, count]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '80px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </div>
          <div style={{ flex: 1, height: '16px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '3px', backgroundColor: color,
              width: `${(count / max) * 100}%`, transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937', width: '30px', textAlign: 'right' }}>
            {count}
          </div>
        </div>
      ))}
    </div>
  );
}
