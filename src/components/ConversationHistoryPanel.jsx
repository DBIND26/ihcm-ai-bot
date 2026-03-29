import React from 'react';

export default function ConversationHistoryPanel({ conversationList, conversationId, loading, onLoadConversation }) {
  return (
    <div style={{
      padding: '16px 24px',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e5e7eb',
      maxHeight: '250px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
        Recent Conversations
      </h3>
      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>Loading...</p>
      ) : conversationList.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
          No saved conversations yet. Start chatting and your history will appear here.
        </p>
      ) : (
        conversationList.map(conv => (
          <button
            key={conv.conversation_id}
            onClick={() => onLoadConversation(conv)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: '6px',
              borderRadius: '6px',
              border: conversationId === conv.conversation_id ? '2px solid #2563eb' : '1px solid #e5e7eb',
              backgroundColor: conversationId === conv.conversation_id ? '#eff6ff' : 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#1f2937' }}>{conv.title || 'Untitled'}</strong>
              <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {conv.last_message || '...'}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
