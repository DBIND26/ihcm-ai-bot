import { useState, useEffect, useRef } from 'react';
import { getRoleById, getRoleIds } from '../v2_definitive/src/bots.js';
import { getActiveBuildings } from '../v2_definitive/src/buildings.js';
import { WORKFLOWS, getWorkflowsForRole } from '../v2_definitive/src/workflows.js';
import { loadMessages, saveMessages, clearMessages } from './storage.js';
import { addSurvey, addEvent, getBuildingHistoryContext, getBuildingHistory } from './buildingHistory.js';
import AccessGate, { ROLE_OPTIONS } from './components/AccessGate.jsx';
import MessageList from './components/MessageList.jsx';
import BuildingHistoryPanel from './components/BuildingHistoryPanel.jsx';
import ConversationHistoryPanel from './components/ConversationHistoryPanel.jsx';

// ROLE_OPTIONS and getUserAccess are now in components/AccessGate.jsx

export default function App() {
  // Access gate — session holds: { userName, selectedRole, allowedRoles, allowedBuildings }
  const [userSession, setUserSession] = useState(null);

  // Feedback state: { [messageIndex]: 'useful' | 'not_useful' | 'wrong' }
  const [feedback, setFeedback] = useState({});
  // Server-side conversation ID (from Supabase, returned by /api/chat)
  const [conversationId, setConversationId] = useState(null);
  // Conversation list from server (for history sidebar)
  const [conversationList, setConversationList] = useState([]);
  const [showConversations, setShowConversations] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // State management
  // Default role/building set after login via useEffect below
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

  // Census CSV upload state
  const [isUploadingCensus, setIsUploadingCensus] = useState(false);
  const [censusResult, setCensusResult] = useState(null);
  const censusInputRef = useRef(null);

  // Knowledge/playbook upload state
  const [showPlaybookForm, setShowPlaybookForm] = useState(false);
  const [playbookData, setPlaybookData] = useState({ title: '', source_type: 'corporate_playbook', content: '', state_code: '', tags: '' });
  const [isUploadingPlaybook, setIsUploadingPlaybook] = useState(false);
  const [playbookResult, setPlaybookResult] = useState(null);

  // Welcome guide state — guarded read for privacy-restricted browsers
  const [seenWelcome, setSeenWelcome] = useState(() => {
    try { return !!localStorage.getItem('ihcm_seen_welcome'); }
    catch { return false; }
  });

  // Building history state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState({ surveys: [], events: [] });
  // showAddEvent/newEvent state moved to BuildingHistoryPanel

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Get current role and active buildings
  const activeRole = getRoleById(activeRoleId);
  const activeBuildings = getActiveBuildings();

  // Load most recent conversation when role or building changes
  useEffect(() => {
    setError(null);
    setActiveWorkflowId(null);
    setWorkflowInputs({});
    setConversationId(null);

    // Try server first, fall back to localStorage
    const loadFromServer = async () => {
      if (!userSession?.userName) return false;
      try {
        const params = new URLSearchParams({ user: userSession.userName, role: activeRoleId });
        if (activeBuildingId && activeBuildingId !== 'none') {
          params.set('building', activeBuildingId);
        }
        const res = await fetch(`/api/conversations?${params}`);
        if (!res.ok) return false;
        const data = await res.json();
        setConversationList(data.conversations || []);

        // Auto-load the most recent conversation
        if (data.conversations?.length > 0) {
          const latest = data.conversations[0];
          const msgRes = await fetch(`/api/conversations?id=${latest.conversation_id}&user=${encodeURIComponent(userSession.userName)}`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (msgData.messages?.length > 0) {
              setMessages(msgData.messages);
              setConversationId(latest.conversation_id);
              return true;
            }
          }
        }
      } catch (err) {
        console.warn('[IHCM] Server conversation load failed, using localStorage:', err);
      }
      return false;
    };

    loadFromServer().then(loaded => {
      if (!loaded) {
        // Fall back to localStorage
        const savedMessages = loadMessages(activeRoleId, activeBuildingId);
        setMessages(savedMessages || []);
        setConversationList([]);
      }
    });
  }, [activeRoleId, activeBuildingId, userSession]);

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
      // Parse all files first — don't persist anything until all succeed
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
      }

      // All files parsed successfully — now persist to history in one batch
      if (activeBuildingId && activeBuildingId !== 'none') {
        for (const doc of newDocs) {
          addSurvey(activeBuildingId, doc);
        }
        setHistoryData(getBuildingHistory(activeBuildingId));
      }

      // Update state with all new docs at once
      const allDocs = [...uploadedDocs, ...newDocs];
      setUploadedDocs(allDocs);

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

      // Pass document context directly — don't rely on stale uploadedDocs state
      const freshDocumentContext = buildDocumentContext(allDocs);
      await sendMessage(uploadMessage, { overrideDocumentContext: freshDocumentContext });

    } catch (err) {
      setUploadError(err.message || 'Failed to parse PDF');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle census CSV upload
  const handleCensusUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file');
      return;
    }

    setIsUploadingCensus(true);
    setCensusResult(null);
    setUploadError(null);

    try {
      const text = await file.text();
      const response = await fetch('/api/ingest-census', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Census upload failed');
      }

      setCensusResult(data);
      // Auto-clear after 10 seconds
      setTimeout(() => setCensusResult(null), 10000);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload census data');
    } finally {
      setIsUploadingCensus(false);
      if (censusInputRef.current) censusInputRef.current.value = '';
    }
  };

  // Handle playbook/knowledge upload
  const handlePlaybookSubmit = async () => {
    if (!playbookData.title.trim() || !playbookData.content.trim()) {
      setUploadError('Title and content are required');
      return;
    }
    setIsUploadingPlaybook(true);
    setPlaybookResult(null);
    setUploadError(null);
    try {
      const res = await fetch('/api/ingest-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: playbookData.title.trim(),
          source_type: playbookData.source_type,
          content: playbookData.content.trim(),
          state_code: playbookData.state_code || undefined,
          tags: playbookData.tags ? playbookData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setPlaybookResult(data);
      setPlaybookData({ title: '', source_type: 'corporate_playbook', content: '', state_code: '', tags: '' });
      setShowPlaybookForm(false);
      setTimeout(() => setPlaybookResult(null), 8000);
    } catch (err) {
      setUploadError(err.message || 'Failed to upload playbook');
    } finally {
      setIsUploadingPlaybook(false);
    }
  };

  // Build document context string for the API — combines given docs array
  const buildDocumentContext = (docs) => {
    if (!docs || !docs.length) return null;
    const allCitations = docs.flatMap(d => d.citations || []);
    if (allCitations.length === 0) return null;

    const parts = [];

    for (const doc of docs) {
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

  // Send message. Optional overrideDocumentContext bypasses stale uploadedDocs state
  // (used by handleFileUpload which has the freshly-parsed docs in hand).
  const sendMessage = async (messageContent = null, { overrideDocumentContext } = {}) => {
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
      // Build extra context — use override if provided (avoids stale state after setUploadedDocs)
      const documentContext = overrideDocumentContext !== undefined
        ? overrideDocumentContext
        : buildDocumentContext(uploadedDocs);
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
          userName: userSession?.userName || undefined,
          conversationId: conversationId || undefined,
        })
      });

      if (!response.ok) {
        const err = new Error(`API error: ${response.status} ${response.statusText}`);
        err.status = response.status;
        throw err;
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

      // Track server-side conversation ID
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setActiveWorkflowId(null);
      setWorkflowInputs({});
    } catch (err) {
      // Provide specific error messages based on failure type
      let errorMsg = 'An error occurred while sending your message.';
      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        errorMsg = 'Request took too long — try a shorter message.';
      } else if (err.message?.includes('429') || err.status === 429) {
        errorMsg = 'Too many requests — please wait a moment and try again.';
      } else if (err.message?.includes('500') || err.message?.includes('502') || err.message?.includes('503')) {
        errorMsg = 'Server error — please try again in a moment.';
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        errorMsg = 'Connection error — check your internet and try again.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      // Clear workflow state on error so it doesn't re-submit
      setActiveWorkflowId(null);
      setWorkflowInputs({});
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
    setConversationId(null);
  };

  // Load a specific conversation from server
  const handleLoadConversation = async (conv) => {
    try {
      const res = await fetch(`/api/conversations?id=${conv.conversation_id}&user=${encodeURIComponent(userSession?.userName)}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMessages(data.messages || []);
      setConversationId(conv.conversation_id);
      setFeedback({});
      setShowConversations(false);
    } catch (err) {
      console.warn('[IHCM] Failed to load conversation:', err);
      setError('Failed to load conversation from server.');
    }
  };

  // Refresh conversation list from server
  const refreshConversationList = async () => {
    if (!userSession?.userName) return;
    setLoadingConversations(true);
    try {
      const params = new URLSearchParams({ user: userSession.userName, role: activeRoleId });
      if (activeBuildingId && activeBuildingId !== 'none') {
        params.set('building', activeBuildingId);
      }
      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversationList(data.conversations || []);
      }
    } catch (err) {
      console.warn('[IHCM] Failed to refresh conversation list:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Handle feedback on a message
  const handleFeedback = (msgIndex, type) => {
    setFeedback(prev => ({ ...prev, [msgIndex]: type }));

    const feedbackData = {
      type,
      user: userSession?.userName,
      role: activeRoleId,
      building: activeBuildingId,
      messagePreview: messages[msgIndex]?.content?.slice(0, 100),
      userQuestion: messages[msgIndex - 1]?.content?.slice(0, 100),
      timestamp: new Date().toISOString(),
    };

    // Store in localStorage as backup
    try {
      const feedbackLog = JSON.parse(localStorage.getItem('ihcm_feedback') || '[]');
      feedbackLog.push({ ...feedbackData, messageIndex: msgIndex });
      localStorage.setItem('ihcm_feedback', JSON.stringify(feedbackLog));
    } catch (err) {
      console.warn('[IHCM] Failed to save feedback to localStorage:', err);
    }

    // POST to feedback API (fire-and-forget, don't block UI)
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...feedbackData, conversationId: conversationId || undefined }),
    }).catch(err => {
      console.warn('[IHCM] Failed to send feedback to API:', err);
    });
  };

  // formatInline, formatContent, handleCopy moved to components/


  // Get applicable starters or draft starters
  const applicableStarters = isDraft
    ? (activeRole?.draftStarters || [])
    : (activeRole?.starters || []);

  // Get workflows for current role
  const roleWorkflows = getWorkflowsForRole(activeRoleId);
  const activeWorkflow = activeWorkflowId ? WORKFLOWS[activeWorkflowId] : null;

  // When session changes, set sensible defaults for role/building
  useEffect(() => {
    if (!userSession) return;
    const { allowedRoles, allowedBuildings } = userSession;
    // Set active role to first allowed role
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(activeRoleId)) {
      setActiveRoleId(allowedRoles[0]);
    }
    // Set active building: if restricted to specific buildings, pick the first one
    if (allowedBuildings && allowedBuildings.length > 0) {
      if (!allowedBuildings.includes(activeBuildingId)) {
        setActiveBuildingId(allowedBuildings[0]);
      }
    } else {
      // null = all buildings — default to "none" (All Buildings)
      if (activeBuildingId === 'none') { /* already good */ }
    }
  }, [userSession]);

  // Access gate
  if (!userSession) {
    return <AccessGate onAuthenticated={(session) => setUserSession(session)} />;
  }

  // Derived from session
  const userName = userSession.userName;
  const allowedRoles = userSession.allowedRoles || getRoleIds();
  const allowedBuildings = userSession.allowedBuildings; // null = all

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
        <div className="ihcm-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userName && (
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              {userName}{userSession.selectedRole ? ` (${ROLE_OPTIONS.find(r => r.id === userSession.selectedRole)?.label || userSession.selectedRole})` : ''}
            </span>
          )}
          <button
            onClick={() => { sessionStorage.removeItem('ihcm_session'); setUserSession(null); }}
            style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid #d1d5db',
              backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px',
              color: '#6b7280'
            }}
          >
            Sign out
          </button>
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
        {getRoleIds().filter(roleId => allowedRoles.includes(roleId)).map(roleId => {
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
          {/* Show "All Buildings" only if user has access to all (allowedBuildings is null) */}
          {!allowedBuildings && <option value="none">All Buildings</option>}
          {(allowedBuildings
            ? activeBuildings.filter(b => allowedBuildings.includes(b.id))
            : activeBuildings
          ).map(building => (
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

        {/* Census CSV upload */}
        <input
          ref={censusInputRef}
          type="file"
          accept=".csv"
          onChange={handleCensusUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => censusInputRef.current?.click()}
          disabled={isUploadingCensus}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: censusResult ? '#dcfce7' : '#f3f4f6',
            cursor: isUploadingCensus ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: censusResult ? '#166534' : '#6b7280',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {isUploadingCensus ? 'Uploading...' : censusResult
            ? `Census updated (${censusResult.buildings?.length} buildings)`
            : 'Upload Census'}
        </button>

        {/* Knowledge/Playbook upload */}
        <button
          onClick={() => setShowPlaybookForm(!showPlaybookForm)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: playbookResult ? '#dcfce7' : showPlaybookForm ? '#dbeafe' : '#f3f4f6',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: playbookResult ? '#166534' : showPlaybookForm ? '#1e40af' : '#6b7280',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {playbookResult ? 'Playbook saved!' : 'Add Playbook'}
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

        {/* Chat History & New Chat — pushed to the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { refreshConversationList(); setShowConversations(!showConversations); }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showConversations ? '#dbeafe' : '#f3f4f6',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: showConversations ? '#1e40af' : '#6b7280',
              whiteSpace: 'nowrap'
            }}
          >
            Chat History {conversationList.length > 0 ? `(${conversationList.length})` : ''}
          </button>
          <button
            onClick={() => {
              if (messages.length > 0 && !window.confirm('Start a new chat? Current conversation will be cleared.')) return;
              handleClearConversation();
              setUploadedDocs([]);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #2563eb',
              backgroundColor: '#eff6ff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              color: '#2563eb',
              whiteSpace: 'nowrap'
            }}
          >
            + New Chat
          </button>
        </div>
      </div>

      {/* Conversation History Panel */}
      {showConversations && (
        <ConversationHistoryPanel
          conversationList={conversationList}
          conversationId={conversationId}
          loading={loadingConversations}
          onLoadConversation={handleLoadConversation}
        />
      )}

      {/* Playbook Upload Form */}
      {showPlaybookForm && (
        <div style={{
          padding: '16px 24px', backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1f2937' }}>
            Add Knowledge Source / Playbook
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Title (e.g., IHCM Falls Prevention Protocol)"
                value={playbookData.title}
                onChange={e => setPlaybookData(prev => ({ ...prev, title: e.target.value }))}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit' }} />
              <select value={playbookData.source_type}
                onChange={e => setPlaybookData(prev => ({ ...prev, source_type: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                <option value="corporate_playbook">Corporate Playbook</option>
                <option value="operator_practice">Operator Practice</option>
                <option value="state_reimbursement">State Reimbursement</option>
                <option value="payer_guidance">Payer Guidance</option>
                <option value="survey_template">Survey Template</option>
                <option value="faq">FAQ</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={playbookData.state_code}
                onChange={e => setPlaybookData(prev => ({ ...prev, state_code: e.target.value }))}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}>
                <option value="">All states</option>
                <option value="AR">Arkansas</option>
                <option value="OH">Ohio</option>
                <option value="PA">Pennsylvania</option>
              </select>
              <input type="text" placeholder="Tags (comma-separated)"
                value={playbookData.tags}
                onChange={e => setPlaybookData(prev => ({ ...prev, tags: e.target.value }))}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', fontFamily: 'inherit' }} />
            </div>
            <textarea placeholder="Paste the document content here..."
              value={playbookData.content}
              onChange={e => setPlaybookData(prev => ({ ...prev, content: e.target.value }))}
              style={{
                padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
                fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '120px',
              }} />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handlePlaybookSubmit} disabled={isUploadingPlaybook || !playbookData.title.trim() || !playbookData.content.trim()}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none',
                  backgroundColor: (playbookData.title.trim() && playbookData.content.trim()) ? '#2563eb' : '#d1d5db',
                  color: 'white', cursor: (playbookData.title.trim() && playbookData.content.trim()) ? 'pointer' : 'not-allowed',
                  fontSize: '13px', fontWeight: '600',
                }}>
                {isUploadingPlaybook ? 'Saving...' : 'Save to Knowledge Base'}
              </button>
              <button onClick={() => setShowPlaybookForm(false)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                  backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280',
                }}>
                Cancel
              </button>
              <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>
                Content will be available to the bot in all future conversations
              </span>
            </div>
          </div>
        </div>
      )}

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
        <BuildingHistoryPanel
          activeBuildingId={activeBuildingId}
          activeBuildings={activeBuildings}
          historyData={historyData}
          onAddEvent={(eventData) => {
            addEvent(activeBuildingId, eventData);
            setHistoryData(getBuildingHistory(activeBuildingId));
          }}
        />
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
              color: '#6b7280',
              textAlign: 'center',
              padding: '24px',
              maxWidth: '520px',
              margin: '0 auto',
            }}
          >
            <p style={{ fontSize: '18px', margin: '0 0 12px 0', fontWeight: '600', color: '#1f2937' }}>
              {activeRole?.name || 'IHCM AI Bot'}
            </p>

            {/* Welcome guide — shows tips for new users */}
            {!seenWelcome ? (
              <div style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.6', color: '#4b5563' }}>
                <p style={{ margin: '0 0 10px 0' }}>Welcome to the IHCM AI Bot! Here's how to get started:</p>
                <p style={{ margin: '0 0 6px 0' }}><strong>Role tabs</strong> — Switch between DON, MDS, Billing, Admin, and Regional views at the top. Each has specialized knowledge.</p>
                <p style={{ margin: '0 0 6px 0' }}><strong>Building selector</strong> — Pick a building to get facility-specific answers (payer mix, staffing context, survey history).</p>
                <p style={{ margin: '0 0 6px 0' }}><strong>Upload 2567</strong> — Upload your CMS Statement of Deficiencies PDF and the bot will analyze every citation with POC guidance.</p>
                <p style={{ margin: '0 0 6px 0' }}><strong>Draft Mode</strong> — Toggle this on to have the bot write formal documents (POC responses, appeal letters, policy drafts).</p>
                <p style={{ margin: '0 0 12px 0' }}><strong>+ New Chat</strong> — Start a fresh conversation anytime. Your history is saved per role and building.</p>
                <button
                  onClick={() => { setSeenWelcome(true); try { localStorage.setItem('ihcm_seen_welcome', '1'); } catch (err) { console.warn('[IHCM] Failed to save welcome flag:', err); } }}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db',
                    backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280'
                  }}
                >
                  Got it, don't show again
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '14px', margin: '0 0 4px 0' }}>
                  {isDraft ? 'Draft mode — ready to write formal documents' : 'Ask a question or pick a starter prompt below'}
                </p>
                <p style={{ fontSize: '13px', margin: 0, color: '#9ca3af' }}>
                  {activeBuildingId !== 'none'
                    ? `Answering for ${activeBuildings.find(b => b.id === activeBuildingId)?.label || activeBuildingId}`
                    : 'No building selected — answers will be general'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <MessageList
            messages={messages}
            activeRole={activeRole}
            feedback={feedback}
            onFeedback={handleFeedback}
            conversationId={conversationId}
          />
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
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#d97706' }}>
            Do not enter patient names, DOBs, SSNs, or other PHI
          </span>
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
