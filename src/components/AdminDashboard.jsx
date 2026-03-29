import { useState, useEffect } from 'react';

export default function AdminDashboard({ authHeaders }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch('/api/admin', { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      {activeTab === 'knowledge' && <KnowledgeTab knowledge={data.knowledge} summary={data.knowledge_summary} />}
      {activeTab === 'surveys' && <SurveysTab surveys={data.recent_surveys} />}
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
  const { conversation_totals, feedback_summary, users, usage_by_role, knowledge_summary } = data;
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

      {/* Usage by Role */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', border: '1px solid #e5e7eb', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>Usage by Role</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(usage_by_role || {}).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
            <div key={role} style={{ textAlign: 'center', minWidth: '70px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>{count}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>{role}</div>
            </div>
          ))}
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

function KnowledgeTab({ knowledge, summary }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <StatCard label="Approved" value={summary?.approved || 0} color="#166534" />
        <StatCard label="Drafts" value={summary?.draft || 0} color="#d97706" />
        <StatCard label="Archived" value={summary?.archived || 0} />
      </div>
      <Table
        columns={[
          { key: 'title', label: 'Title', render: v => (v || '').slice(0, 50) },
          { key: 'source_type', label: 'Type', render: v => <Badge text={v?.replace(/_/g, ' ')} color="gray" /> },
          { key: 'status', label: 'Status', render: v => <Badge text={v} color={v === 'approved' ? 'green' : v === 'draft' ? 'yellow' : 'gray'} /> },
          { key: 'state_code', label: 'State' },
          { key: 'facility_name', label: 'Building' },
          { key: 'current_version', label: 'Ver' },
          { key: 'updated_at', label: 'Updated', render: v => timeAgo(v) },
        ]}
        rows={knowledge || []}
      />
    </>
  );
}

function SurveysTab({ surveys }) {
  return (
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
  );
}
