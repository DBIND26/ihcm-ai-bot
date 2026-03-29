import { useRef } from 'react';

export default function ControlsRow({
  activeBuildingId, activeBuildings, allowedBuildings, activeRoleId,
  isDraft, uploadedDocs, isUploading, isUploadingSwot, swotResult,
  isUploadingCensus, censusResult, showPlaybookForm, playbookResult,
  showHistory, historyData, showConversations, conversationList,
  messages,
  onBuildingChange, onDraftToggle, onFileUpload, onSwotUpload,
  onCensusUpload, onTogglePlaybook, onToggleHistory, onToggleConversations,
  onNewChat,
  fileInputRef, swotInputRef, censusInputRef,
}) {
  return (
    <div
      className="ihcm-controls-row"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 12px',
        padding: '10px 16px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        alignItems: 'center'
      }}
    >
      <select
        value={activeBuildingId}
        onChange={onBuildingChange}
        className="ihcm-building-select"
        style={{
          padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: 'white', fontSize: '13px', cursor: 'pointer'
        }}
      >
        {!allowedBuildings && <option value="none">All Buildings</option>}
        {(allowedBuildings
          ? activeBuildings.filter(b => allowedBuildings.includes(b.id))
          : activeBuildings
        ).map(building => (
          <option key={building.id} value={building.id}>{building.label}</option>
        ))}
      </select>

      <button
        onClick={onDraftToggle}
        className={`ihcm-draft-toggle ${isDraft ? 'ihcm-draft-toggle-active' : ''}`}
        style={{
          padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: isDraft ? '#fef3c7' : '#f3f4f6', cursor: 'pointer',
          fontSize: '13px', fontWeight: '500',
          color: isDraft ? '#92400e' : '#6b7280', transition: 'all 0.2s ease'
        }}
      >
        {isDraft ? '✓ Draft Mode' : 'Draft Mode'}
      </button>

      {/* Upload 2567 */}
      <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={onFileUpload} style={{ display: 'none' }} />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        style={{
          padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: uploadedDocs.length > 0 ? '#dcfce7' : '#f3f4f6',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: '500',
          color: uploadedDocs.length > 0 ? '#166534' : '#6b7280',
          transition: 'all 0.2s ease', whiteSpace: 'nowrap'
        }}
      >
        {isUploading ? 'Parsing...' : uploadedDocs.length > 0
          ? `✓ ${uploadedDocs.length} survey(s) saved (${uploadedDocs.reduce((sum, d) => sum + (d.total_citations || 0), 0)} tags)`
          : 'Upload 2567'}
      </button>

      {/* SWOT upload */}
      {['marketing', 'admin', 'regional'].includes(activeRoleId) && (
        <>
          <input ref={swotInputRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={onSwotUpload} style={{ display: 'none' }} />
          <button
            onClick={() => swotInputRef.current?.click()}
            disabled={isUploadingSwot}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
              backgroundColor: swotResult ? '#dcfce7' : '#f3f4f6',
              cursor: isUploadingSwot ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '500',
              color: swotResult ? '#166534' : '#6b7280',
              transition: 'all 0.2s ease', whiteSpace: 'nowrap',
            }}
          >
            {isUploadingSwot ? 'Uploading...' : swotResult
              ? (() => {
                  const r = swotResult.results || [];
                  const updated = r.filter(x => x.status === 'updated').length;
                  const existing = r.filter(x => x.status === 'already_exists').length;
                  if (existing === r.length) return 'SWOT unchanged';
                  if (updated > 0) return `SWOT updated (${r.length} building${r.length !== 1 ? 's' : ''})`;
                  return `SWOT saved (${r.length} building${r.length !== 1 ? 's' : ''})`;
                })()
              : 'Upload SWOT'}
          </button>
        </>
      )}

      {/* Census CSV */}
      <input ref={censusInputRef} type="file" accept=".csv" onChange={onCensusUpload} style={{ display: 'none' }} />
      <button
        onClick={() => censusInputRef.current?.click()}
        disabled={isUploadingCensus}
        style={{
          padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: censusResult ? '#dcfce7' : '#f3f4f6',
          cursor: isUploadingCensus ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: '500',
          color: censusResult ? '#166534' : '#6b7280',
          transition: 'all 0.2s ease', whiteSpace: 'nowrap'
        }}
      >
        {isUploadingCensus ? 'Uploading...' : censusResult
          ? `Census updated (${censusResult.buildings?.length} buildings)`
          : 'Upload Census'}
      </button>

      {/* Add Playbook */}
      <button
        onClick={onTogglePlaybook}
        style={{
          padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: playbookResult ? '#dcfce7' : showPlaybookForm ? '#dbeafe' : '#f3f4f6',
          cursor: 'pointer', fontSize: '14px', fontWeight: '500',
          color: playbookResult ? '#166534' : showPlaybookForm ? '#1e40af' : '#6b7280',
          transition: 'all 0.2s ease', whiteSpace: 'nowrap'
        }}
      >
        {playbookResult ? 'Playbook queued' : 'Add Playbook'}
      </button>

      {/* Building History */}
      {activeBuildingId && activeBuildingId !== 'none' && (
        <button
          onClick={onToggleHistory}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
            backgroundColor: showHistory ? '#dbeafe' : '#f3f4f6',
            cursor: 'pointer', fontSize: '14px', fontWeight: '500',
            color: showHistory ? '#1e40af' : '#6b7280',
            transition: 'all 0.2s ease', whiteSpace: 'nowrap'
          }}
        >
          History {historyData.surveys.length + historyData.events.length > 0
            ? `(${historyData.surveys.length + historyData.events.length})`
            : ''}
        </button>
      )}

      {/* Chat History & New Chat */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={onToggleConversations}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
            backgroundColor: showConversations ? '#dbeafe' : '#f3f4f6',
            cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: showConversations ? '#1e40af' : '#6b7280', whiteSpace: 'nowrap'
          }}
        >
          Chat History {conversationList.length > 0 ? `(${conversationList.length})` : ''}
        </button>
        <button
          onClick={onNewChat}
          style={{
            padding: '6px 12px', borderRadius: '6px', border: '1px solid #2563eb',
            backgroundColor: '#eff6ff', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', color: '#2563eb', whiteSpace: 'nowrap'
          }}
        >
          + New Chat
        </button>
      </div>
    </div>
  );
}
