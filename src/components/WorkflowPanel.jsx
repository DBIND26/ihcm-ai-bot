export default function WorkflowPanel({
  activeWorkflowId, activeWorkflow, showWorkflowPanel, roleWorkflows,
  workflowInputs, isLoading, activeRole,
  onWorkflowChange, onWorkflowInputChange, onStartWorkflow,
}) {
  return (
    <div
      className="ihcm-workflow-section"
      style={{
        padding: '12px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb'
      }}
    >
      <select
        value={activeWorkflowId || ''}
        onChange={onWorkflowChange}
        className="ihcm-workflow-select"
        style={{
          padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
          backgroundColor: 'white', fontSize: '14px', cursor: 'pointer', width: '100%'
        }}
      >
        <option value="">Select a workflow...</option>
        {roleWorkflows.map(wf => (
          <option key={wf.id} value={wf.id}>{wf.label}</option>
        ))}
      </select>

      {activeWorkflow && showWorkflowPanel && (
        <div
          className="ihcm-workflow-panel"
          style={{
            marginTop: '12px', padding: '16px',
            backgroundColor: '#f3f4f6', borderRadius: '6px', border: '1px solid #d1d5db'
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4b5563' }}>
            {activeWorkflow.description}
          </p>

          {/* Required Inputs */}
          {activeWorkflow.requiredInputs?.length > 0 && (
            <div className="ihcm-workflow-inputs">
              {activeWorkflow.requiredInputs.map(input => (
                <WorkflowField key={input.name} input={input} value={workflowInputs[input.name] || ''} onChange={onWorkflowInputChange} />
              ))}
            </div>
          )}

          {/* Optional Inputs */}
          {activeWorkflow.optionalInputs?.length > 0 && (
            <div className="ihcm-workflow-inputs" style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Optional
              </div>
              {activeWorkflow.optionalInputs.map(input => (
                <WorkflowField key={input.name} input={input} value={workflowInputs[input.name] || ''} onChange={onWorkflowInputChange} />
              ))}
            </div>
          )}

          <button
            onClick={onStartWorkflow}
            disabled={isLoading}
            className="ihcm-start-workflow-btn"
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              backgroundColor: activeRole?.color || '#3b82f6', color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '600',
              opacity: isLoading ? 0.6 : 1, transition: 'all 0.2s ease'
            }}
          >
            {isLoading ? 'Starting...' : 'Start Workflow'}
          </button>
        </div>
      )}
    </div>
  );
}

function WorkflowField({ input, value, onChange }) {
  return (
    <div className="ihcm-workflow-input-group" style={{ marginBottom: '10px' }}>
      <label className="ihcm-workflow-input-label" style={{
        display: 'block', fontSize: '13px', fontWeight: '500',
        marginBottom: '4px', color: '#374151'
      }}>
        {input.label}
      </label>
      {input.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(input.name, e.target.value)}
          placeholder={input.placeholder || ''}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit',
            resize: 'vertical', minHeight: '80px', boxSizing: 'border-box',
          }}
        />
      ) : input.type === 'select' && input.options ? (
        <select
          value={value}
          onChange={e => onChange(input.name, e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit',
            boxSizing: 'border-box', backgroundColor: 'white',
          }}
        >
          <option value="">{input.placeholder || 'Select...'}</option>
          {input.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={input.type || 'text'}
          value={value}
          onChange={e => onChange(input.name, e.target.value)}
          placeholder={input.placeholder || ''}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}
