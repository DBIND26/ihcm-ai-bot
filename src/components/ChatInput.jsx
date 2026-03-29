import { forwardRef } from 'react';

const ChatInput = forwardRef(function ChatInput({
  inputText, isLoading, activeRole, activeRoleId, activeBuildingId,
  activeBuildings, messages, uploadedDocs,
  onInputChange, onSend, onClear, onClearDocs, onExport,
}, ref) {
  return (
    <div className="ihcm-input-area" style={{ padding: '12px 16px', backgroundColor: 'white', borderTop: '1px solid #e5e7eb' }}>
      <div className="ihcm-input-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={ref}
          value={inputText}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type your message..."
          disabled={isLoading}
          className="ihcm-input-textarea"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
            fontSize: '14px', fontFamily: 'inherit', resize: 'none',
            minHeight: '44px', maxHeight: '120px', boxSizing: 'border-box',
            opacity: isLoading ? 0.6 : 1
          }}
        />
        <button
          onClick={() => onSend()}
          disabled={isLoading || !inputText.trim()}
          className="ihcm-send-button"
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            backgroundColor: activeRole?.color || '#3b82f6', color: 'white',
            cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: '600',
            opacity: isLoading || !inputText.trim() ? 0.6 : 1,
            transition: 'all 0.2s ease', whiteSpace: 'nowrap',
            height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
        <button onClick={onClear} style={{
          background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
          fontSize: '12px', textDecoration: 'underline'
        }}>
          Clear conversation
        </button>
        {uploadedDocs.length > 0 && (
          <button onClick={onClearDocs} style={{
            background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
            fontSize: '12px', textDecoration: 'underline'
          }}>
            Clear 2567 context
          </button>
        )}
        {messages.length > 0 && (
          <button onClick={onExport} style={{
            background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
            fontSize: '12px', textDecoration: 'underline'
          }}>
            Export conversation
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#d97706' }}>
          Do not enter patient names, DOBs, SSNs, or other PHI
        </span>
      </div>
    </div>
  );
});

export default ChatInput;
