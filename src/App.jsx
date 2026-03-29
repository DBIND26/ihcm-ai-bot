import React, { useState, useEffect, useRef } from 'react';
import { ROLES, getRoleById, getRoleIds } from '../v2_definitive/src/bots.js';
import { BUILDINGS, getActiveBuildings } from '../v2_definitive/src/buildings.js';
import { WORKFLOWS, getWorkflowsForRole } from '../v2_definitive/src/workflows.js';
import { loadMessages, saveMessages, clearMessages } from './storage.js';
import {
  addSurvey, getSurveys, getLatestSurvey,
  addEvent, getEvents,
  getBuildingHistoryContext, getBuildingHistory,
  EVENT_CATEGORIES,
} from './buildingHistory.js';

// ── Access Gate Component ──
function AccessGate({ onAuthenticated }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const saved = sessionStorage.getItem('ihcm_access');
    if (saved === 'granted') {
      onAuthenticated();
      return;
    }
    // Check if access code is even required
    fetch('/api/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          sessionStorage.setItem('ihcm_access', 'granted');
          onAuthenticated();
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem('ihcm_access', 'granted');
        onAuthenticated();
      } else {
        setError('Invalid access code');
      }
    } catch {
      setError('Connection error — try again');
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f9fafb'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white', padding: '40px', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '600', color: '#1f2937' }}>
          IHCM AI Bot
        </h1>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280' }}>
          Enter your team access code
        </p>
        <input
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Access code"
          autoFocus
          style={{
            width: '100%', padding: '12px 16px', borderRadius: '8px',
            border: '1px solid #d1d5db', fontSize: '16px', fontFamily: 'inherit',
            boxSizing: 'border-box', marginBottom: '12px'
          }}
        />
        {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px 0' }}>{error}</p>}
        <button type="submit" style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          backgroundColor: '#2563eb', color: 'white', fontSize: '15px',
          fontWeight: '600', cursor: 'pointer'
        }}>
          Enter
        </button>
      </form>
    </div>
  );
}

export default function App() {
  // Access gate
  const [authenticated, setAuthenticated] = useState(false);

  // Feedback state: { [messageIndex]: 'useful' | 'not_useful' | 'wrong' }
  const [feedback, setFeedback] = useState({});

  // State management
  const [activeRoleId, setActiveRoleId] = useState('don');
  const [activeBuildingId, setActiveBuildingId] = useState('none');
  const [isDraft, setIsDraft] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [workflowInputs, setWorkflowInputs] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);

  // 2567 Upload state — supports multiple documents
  const [uploadedDocs, setUploadedDocs] = useState([]); // array of parsed citation data
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Building history state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState({ surveys: [], events: [] });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ category: 'general', title: '', description: '', date: '' });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Get current role and active buildings
  const activeRole = getRoleById(activeRoleId);
  const activeBuildings = getActiveBuildings();

  // Load messages when role or building changes
  useEffect(() => {
    const savedMessages = loadMessages(activeRoleId, activeBuildingId);
    setMessages(savedMessages || []);
    setError(null);
    setActiveWorkflowId(null);
    setWorkflowInputs({});
  }, [activeRoleId, activeBuildingId]);

  // Load building history when building changes
  useEffect(() => {
    if (activeBuildingId && activeBuildingId !== 'none') {
      setHistoryData(getBuildingHistory(activeBuildingId));
    } else {
      setHistoryData({ surveys: [], events: [] });
    }
    // Clear uploaded docs when building changes
    setUploadedDocs([]);
    setUploadError(null);
  }, [activeBuildingId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle role change
  const handleRoleChange = (roleId) => {
    setActiveRoleId(roleId);
  };

  // Handle building change
  const handleBuildingChange = (e) => {
    setActiveBuildingId(e.target.value);
  };

  // Handle draft mode toggle
  const handleDraftToggle = () => {
    setIsDraft(!isDraft);
    setActiveWorkflowId(null);
    setWorkflowInputs({});
  };

  // Handle workflow selection
  const handleWorkflowChange = (e) => {
    const workflowId = e.target.value;
    setActiveWorkflowId(workflowId);
    setWorkflowInputs({});
    if (workflowId) {
      setShowWorkflowPanel(true);
    }
  };

  // Handle workflow input change
  const handleWorkflowInputChange = (inputName, value) => {
    setWorkflowInputs(prev => ({
      ...prev,
      [inputName]: value
    }));
  };

  // Start workflow
  const handleStartWorkflow = async () => {
    if (!activeWorkflowId) return;

    const workflow = WORKFLOWS[activeWorkflowId];
    if (!workflow) return;

    // Validate required inputs
    const missingRequired = workflow.requiredInputs.filter(
      input => !workflowInputs[input.name] || workflowInputs[input.name].trim() === ''
    );

    if (missingRequired.length > 0) {
      setError(`Please fill in: ${missingRequired.map(i => i.label).join(', ')}`);
      return;
    }

    // Build workflow message
    const workflowMessage = `[Workflow: ${workflow.label}]\n${
      workflow.requiredInputs
        .map(input => `${input.label}: ${workflowInputs[input.name]}`)
        .join('\n')
    }`;

    // Send workflow as user message
    await sendMessage(workflowMessage);
    setShowWorkflowPanel(false);
  };

  // Handle 2567 PDF upload (supports multiple files)
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      setUploadError('Please upload PDF files');
      return;
    }

    const tooBig = pdfFiles.find(f => f.size > 20 * 1024 * 1024);
    if (tooBig) {
      setUploadError(`File too large (max 20MB): ${tooBig.name}`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const newDocs = [];

    try {
      for (const file of pdfFiles) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-2567', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`${file.name}: ${data.error}`);
        }

        data._fileName = file.name;
        newDocs.push(data);

        // Auto-save to building history if a building is selected
        if (activeBuildingId && activeBuildingId !== 'none') {
          addSurvey(activeBuildingId, data);
        }
      }

      setUploadedDocs(prev => [...prev, ...newDocs]);

      if (activeBuildingId && activeBuildingId !== 'none') {
        setHistoryData(getBuildingHistory(activeBuildingId));
      }

      // Build summary of ALL newly uploaded docs
      const allCitations = newDocs.flatMap(d => d.citations || []);
      const surveyList = newDocs.map(d =>
        `${d.facility_name || d._fileName} (${d.survey_date || 'date unknown'}, ${d.survey_type || 'standard'} survey, ${d.total_citations || 0} citations)`
      ).join('\n');

      const tagSummary = allCitations
        .map(c => `${c.f_tag}${c.scope_severity ? ` (${c.scope_severity})` : ''}: ${c.tag_description || 'No description'}${c.deficient_practice ? ' — ' + c.deficient_practice.slice(0, 150) : ''}`)
        .join('\n');

      const criticalTags = newDocs.flatMap(d => d.critical_tags || []);
      const criticalNote = criticalTags.length > 0
        ? `\n\nCRITICAL TAGS: ${[...new Set(criticalTags)].join(', ')}`
        : '';

      const uploadMessage = `I uploaded ${newDocs.length} survey(s):\n${surveyList}\n\nTotal ${allCitations.length} citation(s):\n${tagSummary}${criticalNote}\n\nPlease review these citations and give me specific POC guidance for each, prioritized by severity. The full findings text is available in your context.`;

      await sendMessage(uploadMessage);

    } catch (err) {
      setUploadError(err.message || 'Failed to parse PDF');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle adding a building event
  const handleAddEvent = () => {
    if (!activeBuildingId || activeBuildingId === 'none') return;
    if (!newEvent.title.trim()) return;

    addEvent(activeBuildingId, {
      ...newEvent,
      date: newEvent.date || new Date().toISOString().split('T')[0],
    });
    setHistoryData(getBuildingHistory(activeBuildingId));
    setNewEvent({ category: 'general', title: '', description: '', date: '' });
    setShowAddEvent(false);
  };

  // Build document context string for the API — combines ALL uploaded docs
  const getDocumentContextForApi = () => {
    if (!uploadedDocs.length) return null;
    const allCitations = uploadedDocs.flatMap(d => d.citations || []);
    if (allCitations.length === 0) return null;

    const parts = [];

    for (const doc of uploadedDocs) {
      parts.push(`=== SURVEY: ${doc.facility_name || doc._fileName || 'Unknown'} | Date: ${doc.survey_date || 'Unknown'} | Type: ${doc.survey_type || 'standard'} ===`);
      parts.push(`Total Citations: ${doc.total_citations || 0}`);
      if (doc.critical_tags?.length) {
        parts.push(`Critical Tags: ${doc.critical_tags.join(', ')}`);
      }
      parts.push('');

      for (const c of (doc.citations || [])) {
        parts.push(`--- ${c.f_tag} ${c.tag_description ? '— ' + c.tag_description : ''} ---`);
        if (c.regulation) parts.push(`Regulation: ${c.regulation}`);
        if (c.scope_severity) parts.push(`Scope/Severity: ${c.scope_severity}`);
        if (c.deficient_practice) parts.push(`Deficient Practice: ${c.deficient_practice}`);
        if (c.findings) parts.push(`Findings: ${c.findings}`);
        if (c.plan_of_correction_due) parts.push(`POC Due: ${c.plan_of_correction_due}`);
        parts.push('');
      }
      parts.push('');
    }
    return parts.join('\n');
  };

  // Send message
  const sendMessage = async (messageContent = null) => {
    const content = messageContent || inputText.trim();

    if (!content || isLoading) return;

    setError(null);
    setIsLoading(true);

    // Add user message
    const userMessage = { role: 'user', content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');

    try {
      // Build extra context
      const documentContext = getDocumentContextForApi();
      const historyContext = (activeBuildingId && activeBuildingId !== 'none')
        ? getBuildingHistoryContext(activeBuildingId)
        : null;

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: activeRoleId,
          buildingId: activeBuildingId,
          isDraft,
          messages: updatedMessages,
          workflowId: activeWorkflowId || null,
          documentContext: documentContext || undefined,
          historyContext: historyContext || undefined,
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.reply) {
        throw new Error('No reply received from API');
      }

      // Add assistant message
      const assistantMessage = { role: 'assistant', content: data.reply };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Save to storage
      saveMessages(activeRoleId, activeBuildingId, finalMessages);

      setActiveWorkflowId(null);
      setWorkflowInputs({});
    } catch (err) {
      setError(err.message || 'An error occurred while sending your message.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle starter prompt click
  const handleStarterClick = (starter) => {
    sendMessage(starter);
  };

  // Clear conversation
  const handleClearConversation = () => {
    clearMessages(activeRoleId, activeBuildingId);
    setMessages([]);
    setError(null);
    setActiveWorkflowId(null);
    setWorkflowInputs({});
    setFeedback({});
  };

  // Handle feedback on a message
  const handleFeedback = (msgIndex, type) => {
    setFeedback(prev => ({ ...prev, [msgIndex]: type }));
    // Store feedback in localStorage for later review
    try {
      const feedbackLog = JSON.parse(localStorage.getItem('ihcm_feedback') || '[]');
      feedbackLog.push({
        type,
        role: activeRoleId,
        building: activeBuildingId,
        messageIndex: msgIndex,
        messagePreview: messages[msgIndex]?.content?.slice(0, 100),
        userQuestion: messages[msgIndex - 1]?.content?.slice(0, 100),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('ihcm_feedback', JSON.stringify(feedbackLog));
    } catch {}
  };

  // Format markdown-like content
  const formatContent = (content) => {
    // Split by lines and process
    const lines = content.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Headers (##)
      if (line.startsWith('##')) {
        result.push(
          <h3 key={`h3-${i}`} className="ihcm-message-header">
            {line.replace(/^##\s*/, '')}
          </h3>
        );
        i++;
        continue;
      }

      // Bold text (**)
      const boldRegex = /\*\*([^*]+)\*\*/g;
      const boldLine = line.split(boldRegex).map((part, idx) => {
        if (idx % 2 === 1) {
          return <strong key={`bold-${i}-${idx}`}>{part}</strong>;
        }
        return part;
      });

      // Bullet points (-)
      if (line.trim().startsWith('-')) {
        result.push(
          <li key={`li-${i}`} className="ihcm-message-bullet">
            {boldLine}
          </li>
        );
      } else if (line.trim() === '') {
        // Empty line
        result.push(<div key={`empty-${i}`} className="ihcm-message-spacing" />);
      } else {
        // Regular paragraph
        result.push(
          <p key={`p-${i}`} className="ihcm-message-text">
            {boldLine}
          </p>
        );
      }

      i++;
    }

    return result;
  };

  // Get applicable starters or draft starters
  const applicableStarters = isDraft
    ? (activeRole?.draftStarters || [])
    : (activeRole?.starters || []);

  // Get workflows for current role
  const roleWorkflows = getWorkflowsForRole(activeRoleId);
  const activeWorkflow = activeWorkflowId ? WORKFLOWS[activeWorkflowId] : null;

  // Access gate
  if (!authenticated) {
    return <AccessGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div
      className="ihcm-app"
      style={{
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <header
        className="ihcm-header"
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="ihcm-header-content">
          <h1 className="ihcm-header-title" style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600' }}>
            IHCM AI Bot
          </h1>
          <p
            className="ihcm-header-subtitle"
            style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}
          >
            {activeRole?.name} {activeBuildingId !== 'none' && `• ${activeBuildings.find(b => b.id === activeBuildingId)?.label || ''}`}
          </p>
        </div>
      </header>

      {/* Role Tabs */}
      <div
        className="ihcm-tabs"
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto'
        }}
      >
        {getRoleIds().map(roleId => {
          const role = getRoleById(roleId);
          const isActive = roleId === activeRoleId;
          return (
            <button
              key={roleId}
              onClick={() => handleRoleChange(roleId)}
              className={`ihcm-tab ${isActive ? 'ihcm-tab-active' : ''}`}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: isActive ? role?.colorBg || '#e5e7eb' : 'transparent',
                color: isActive ? role?.color || '#1f2937' : '#6b7280',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {role?.tab || roleId}
            </button>
          );
        })}
      </div>

      {/* Controls Row: Building Selector & Draft Toggle */}
      <div
        className="ihcm-controls-row"
        style={{
          display: 'flex',
          gap: '16px',
          padding: '12px 24px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          alignItems: 'center'
        }}
      >
        <select
          value={activeBuildingId}
          onChange={handleBuildingChange}
          className="ihcm-building-select"
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="none">All Buildings</option>
          {activeBuildings.map(building => (
            <option key={building.id} value={building.id}>
              {building.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleDraftToggle}
          className={`ihcm-draft-toggle ${isDraft ? 'ihcm-draft-toggle-active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: isDraft ? '#fef3c7' : '#f3f4f6',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: isDraft ? '#92400e' : '#6b7280',
            transition: 'all 0.2s ease'
          }}
        >
          {isDraft ? '✓ Draft Mode' : 'Draft Mode'}
        </button>

        {/* Upload 2567 button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: uploadedDocs.length > 0 ? '#dcfce7' : '#f3f4f6',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: uploadedDocs.length > 0 ? '#166534' : '#6b7280',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {isUploading ? 'Parsing...' : uploadedDocs.length > 0
            ? `✓ ${uploadedDocs.length} survey(s) (${uploadedDocs.reduce((sum, d) => sum + (d.total_citations || 0), 0)} tags)`
            : 'Upload 2567'}
        </button>

        {/* Building History toggle */}
        {activeBuildingId && activeBuildingId !== 'none' && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showHistory ? '#dbeafe' : '#f3f4f6',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: showHistory ? '#1e40af' : '#6b7280',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            History {historyData.surveys.length + historyData.events.length > 0
              ? `(${historyData.surveys.length + historyData.events.length})`
              : ''}
          </button>
        )}
      </div>

      {/* Upload error */}
      {uploadError && (
        <div style={{
          padding: '8px 24px',
          backgroundColor: '#fef2f2',
          color: '#991b1b',
          fontSize: '13px',
          borderBottom: '1px solid #fecaca',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Upload: {uploadError}</span>
          <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Building History Panel */}
      {showHistory && activeBuildingId && activeBuildingId !== 'none' && (
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
              Building History — {activeBuildings.find(b => b.id === activeBuildingId)?.label || activeBuildingId}
            </h3>
            <button
              onClick={() => setShowAddEvent(!showAddEvent)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                color: '#4b5563'
              }}
            >
              + Add Event
            </button>
          </div>

          {/* Add Event Form */}
          {showAddEvent && (
            <div style={{
              padding: '12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              marginBottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newEvent.category}
                  onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value }))}
                  style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
                >
                  {EVENT_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                  style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
                />
              </div>
              <input
                type="text"
                placeholder="Event title..."
                value={newEvent.title}
                onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
              <input
                type="text"
                placeholder="Description (optional)..."
                value={newEvent.description}
                onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
              <button
                onClick={handleAddEvent}
                disabled={!newEvent.title.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: newEvent.title.trim() ? '#3b82f6' : '#d1d5db',
                  color: 'white',
                  cursor: newEvent.title.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  fontWeight: '500',
                  alignSelf: 'flex-start'
                }}
              >
                Save Event
              </button>
            </div>
          )}

          {/* Survey History */}
          {historyData.surveys.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Surveys ({historyData.surveys.length})
              </h4>
              {historyData.surveys.map((survey, idx) => (
                <div key={survey.id || idx} style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '4px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{survey.date} — {survey.type} survey</strong>
                    <span style={{ color: '#6b7280' }}>{survey.totalTags} citation(s)</span>
                  </div>
                  {survey.criticalTags?.length > 0 && (
                    <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                      Critical: {survey.criticalTags.join(', ')}
                    </div>
                  )}
                  {survey.citations?.length > 0 && (
                    <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                      Tags: {survey.citations.map(c => c.fTag).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Event Timeline */}
          {historyData.events.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Events ({historyData.events.length})
              </h4>
              {historyData.events.map((event, idx) => (
                <div key={event.id || idx} style={{
                  padding: '8px 12px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '4px',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{event.title}</strong>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: '#f3f4f6',
                      color: '#4b5563'
                    }}>
                      {event.category}
                    </span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>
                    {event.date} {event.description && `— ${event.description}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {historyData.surveys.length === 0 && historyData.events.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
              No history yet. Upload a 2567 or add events to build this building's timeline.
            </p>
          )}
        </div>
      )}

      {/* Workflow Selector & Panel */}
      {(isDraft || activeWorkflowId) && roleWorkflows.length > 0 && (
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
            onChange={handleWorkflowChange}
            className="ihcm-workflow-select"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              fontSize: '14px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <option value="">Select a workflow...</option>
            {roleWorkflows.map(wf => (
              <option key={wf.id} value={wf.id}>
                {wf.label}
              </option>
            ))}
          </select>

          {/* Workflow Panel */}
          {activeWorkflow && showWorkflowPanel && (
            <div
              className="ihcm-workflow-panel"
              style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                border: '1px solid #d1d5db'
              }}
            >
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#4b5563' }}>
                {activeWorkflow.description}
              </p>

              {activeWorkflow.requiredInputs && activeWorkflow.requiredInputs.length > 0 && (
                <div className="ihcm-workflow-inputs">
                  {activeWorkflow.requiredInputs.map(input => (
                    <div
                      key={input.name}
                      className="ihcm-workflow-input-group"
                      style={{ marginBottom: '12px' }}
                    >
                      <label
                        className="ihcm-workflow-input-label"
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '500',
                          marginBottom: '6px',
                          color: '#374151'
                        }}
                      >
                        {input.label}
                      </label>
                      {input.type === 'textarea' ? (
                        <textarea
                          value={workflowInputs[input.name] || ''}
                          onChange={e => handleWorkflowInputChange(input.name, e.target.value)}
                          placeholder={input.placeholder || ''}
                          className="ihcm-workflow-textarea"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            minHeight: '80px'
                          }}
                        />
                      ) : (
                        <input
                          type={input.type || 'text'}
                          value={workflowInputs[input.name] || ''}
                          onChange={e => handleWorkflowInputChange(input.name, e.target.value)}
                          placeholder={input.placeholder || ''}
                          className="ihcm-workflow-input"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '13px',
                            fontFamily: 'inherit',
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleStartWorkflow}
                disabled={isLoading}
                className="ihcm-start-workflow-btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeRole?.color || '#3b82f6',
                  color: 'white',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? 'Starting...' : 'Start Workflow'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages Container */}
      <div
        className="ihcm-messages-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {messages.length === 0 ? (
          <div
            className="ihcm-empty-state"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#9ca3af',
              textAlign: 'center'
            }}
          >
            <p style={{ fontSize: '16px', margin: '0 0 8px 0' }}>
              Start a conversation with {activeRole?.name}
            </p>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {isDraft ? 'Draft mode enabled' : 'Ready to assist'}
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
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
                  backgroundColor:
                    msg.role === 'user'
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
                {/* Feedback buttons for assistant messages */}
                {msg.role === 'assistant' && (
                  <div style={{
                    display: 'flex', gap: '6px', marginTop: '8px', paddingTop: '6px',
                    borderTop: '1px solid rgba(0,0,0,0.06)'
                  }}>
                    {[
                      { type: 'useful', label: 'Useful', icon: '\u2191' },
                      { type: 'not_useful', label: 'Not useful', icon: '\u2193' },
                      { type: 'wrong', label: 'Wrong', icon: '!' },
                    ].map(fb => (
                      <button
                        key={fb.type}
                        onClick={() => handleFeedback(idx, fb.type)}
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
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div
            className="ihcm-typing-indicator"
            style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center'
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#d1d5db',
                animation: 'pulse 1.4s infinite'
              }}
            />
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#d1d5db',
                animation: 'pulse 1.4s infinite 0.2s'
              }}
            />
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#d1d5db',
                animation: 'pulse 1.4s infinite 0.4s'
              }}
            />
          </div>
        )}

        {/* Starter Prompts */}
        {messages.length === 0 && applicableStarters.length > 0 && (
          <div
            className="ihcm-starters"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '16px'
            }}
          >
            {applicableStarters.map((starter, idx) => (
              <button
                key={idx}
                onClick={() => handleStarterClick(starter)}
                className="ihcm-starter-chip"
                style={{
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: `1px solid ${activeRole?.color || '#3b82f6'}`,
                  backgroundColor: 'transparent',
                  color: activeRole?.color || '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="ihcm-error-message"
          style={{
            padding: '12px 24px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            fontSize: '13px',
            borderTop: '1px solid #fecaca',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#991b1b',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Area */}
      <div
        className="ihcm-input-area"
        style={{
          padding: '16px 24px',
          backgroundColor: 'white',
          borderTop: '1px solid #e5e7eb'
        }}
      >
        <div
          className="ihcm-input-wrapper"
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end'
          }}
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={isLoading}
            className="ihcm-input-textarea"
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
              boxSizing: 'border-box',
              opacity: isLoading ? 0.6 : 1
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !inputText.trim()}
            className="ihcm-send-button"
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeRole?.color || '#3b82f6',
              color: 'white',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              opacity: isLoading || !inputText.trim() ? 0.6 : 1,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            fontSize: '12px',
            color: '#9ca3af'
          }}
        >
          <button
            onClick={handleClearConversation}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              textDecoration: 'underline'
            }}
          >
            Clear conversation
          </button>
          {uploadedDocs.length > 0 && (
            <button
              onClick={() => setUploadedDocs([])}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '12px',
                textDecoration: 'underline'
              }}
            >
              Clear 2567 context
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
