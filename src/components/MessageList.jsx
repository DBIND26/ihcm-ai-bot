import React, { useState } from 'react';
import formatContent from './formatMarkdown.jsx';

export default function MessageList({ messages, activeRole, feedback, onFeedback, conversationId }) {
  const [copiedMsg, setCopiedMsg] = useState(null);

  const handleCopy = async (msgIndex, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsg(msgIndex);
      setTimeout(() => setCopiedMsg(null), 2000);
    } catch (err) {
      console.warn('[IHCM] Copy to clipboard failed:', err);
    }
  };

  return (
    <>
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`ihcm-message ihcm-message-${msg.role}`}
          style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}
        >
          <div
            className={`ihcm-message-bubble ihcm-message-bubble-${msg.role}`}
            style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: msg.role === 'user'
                ? activeRole?.color || '#3b82f6'
                : '#e5e7eb',
              color: msg.role === 'user' ? 'white' : '#1f2937',
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word'
            }}
          >
            <div className="ihcm-message-content">
              {msg.role === 'user' ? (
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                  {msg.content}
                </p>
              ) : (
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  {formatContent(msg.content)}
                </div>
              )}
            </div>
            {/* Feedback & copy buttons for assistant messages */}
            {msg.role === 'assistant' && (
              <div style={{
                display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '6px',
                borderTop: '1px solid rgba(0,0,0,0.06)', alignItems: 'center'
              }}>
                {[
                  { type: 'useful', label: 'Useful', icon: '\u2191' },
                  { type: 'not_useful', label: 'Not useful', icon: '\u2193' },
                  { type: 'wrong', label: 'Wrong', icon: '!' },
                ].map(fb => (
                  <button
                    key={fb.type}
                    onClick={() => onFeedback(idx, fb.type)}
                    style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                      border: feedback[idx] === fb.type ? '1px solid #2563eb' : '1px solid #d1d5db',
                      backgroundColor: feedback[idx] === fb.type ? '#dbeafe' : 'transparent',
                      color: feedback[idx] === fb.type ? '#1e40af' : '#9ca3af',
                      cursor: 'pointer', fontWeight: '500',
                    }}
                  >
                    {fb.icon} {fb.label}
                  </button>
                ))}
                <button
                  onClick={() => handleCopy(idx, msg.content)}
                  style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                    border: '1px solid #d1d5db',
                    backgroundColor: copiedMsg === idx ? '#dcfce7' : 'transparent',
                    color: copiedMsg === idx ? '#166534' : '#9ca3af',
                    cursor: 'pointer', fontWeight: '500', marginLeft: 'auto',
                  }}
                >
                  {copiedMsg === idx ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
