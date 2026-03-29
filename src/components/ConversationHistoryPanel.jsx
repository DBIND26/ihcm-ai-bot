import { useState } from 'react';

export default function ConversationHistoryPanel({ conversationList, conversationId, loading, onLoadConversation, onDeleteConversation }) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? conversationList.filter(conv => {
        const q = search.toLowerCase();
        return (conv.title || '').toLowerCase().includes(q) ||
               (conv.last_message || '').toLowerCase().includes(q);
      })
    : conversationList;

  return (
    <div style={{
      padding: '12px 24px 16px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e5e7eb',
      maxHeight: '350px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
          Conversations {conversationList.length > 0 && `(${conversationList.length})`}
        </h3>
      </div>

      {/* Search */}
      {conversationList.length > 3 && (
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          style={{
            padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
            fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px',
            width: '100%', boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Loading...</p>
        ) : conversationList.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            No saved conversations yet. Start chatting and your history will appear here.
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            No conversations match "{search}"
          </p>
        ) : (
          filtered.map(conv => (
            <button
              key={conv.conversation_id}
              onClick={() => onLoadConversation(conv)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                marginBottom: '4px',
                borderRadius: '6px',
                border: conversationId === conv.conversation_id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                backgroundColor: conversationId === conv.conversation_id ? '#eff6ff' : 'white',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#1f2937', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title || 'Untitled'}
                </strong>
                <span style={{ color: '#9ca3af', fontSize: '11px', marginRight: '8px', flexShrink: 0 }}>
                  {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                </span>
                {onDeleteConversation && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this conversation? This cannot be undone.')) {
                        onDeleteConversation(conv.conversation_id);
                      }
                    }}
                    style={{
                      color: '#9ca3af', fontSize: '14px', cursor: 'pointer',
                      padding: '0 4px', lineHeight: 1, flexShrink: 0,
                    }}
                    title="Delete conversation"
                  >
                    ✕
                  </span>
                )}
              </div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.last_message || '...'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
