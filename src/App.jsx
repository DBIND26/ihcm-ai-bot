import React, { useState, useEffect, useRef } from 'react';
import { ROLES, getRoleById, getRoleIds } from '../v2_definitive/src/bots.js';
import { BUILDINGS, getActiveBuildings } from '../v2_definitive/src/buildings.js';
import { WORKFLOWS, getWorkflowsForRole } from '../v2_definitive/src/workflows.js';
import { loadMessages, saveMessages, clearMessages, listConversations } from './storage.js';
import {
  addSurvey, getSurveys, getLatestSurvey,
  addEvent, getEvents,
  getBuildingHistoryContext, getBuildingHistory,
  EVENT_CATEGORIES,
} from './buildingHistory.js';

// ── Role/Building access rules ──
// DON, MDS, Admin = their role only, their building(s) only
// Billing = billing only, all buildings
// Regional = all roles EXCEPT billing, all buildings
// Dov = everything

const ROLE_OPTIONS = [
  { id: 'don', label: 'Director of Nursing (DON)', needsBuilding: true },
  { id: 'mds', label: 'MDS Coordinator', needsBuilding: true },
  { id: 'billing', label: 'Billing & RCM', needsBuilding: false },
  { id: 'admin', label: 'Facility Administrator', needsBuilding: true },
  { id: 'regional', label: 'Regional Operations', needsBuilding: false },
];

function getUserAccess(userName, selectedRole, selectedBuildings) {
  const nameLower = (userName || '').toLowerCase().trim();

  // Dov gets everything
  if (nameLower === 'dov' || nameLower === 'dov braun' || nameLower.includes('dbraun')) {
    return {
      allowedRoles: ['mds', 'don', 'billing', 'admin', 'regional'],
      allowedBuildings: null, // null = all buildings
    };
  }

  // Regional: all roles except billing, all buildings
  if (selectedRole === 'regional') {
    return {
      allowedRoles: ['mds', 'don', 'admin', 'regional'],
      allowedBuildings: null,
    };
  }

  // Billing: billing only, all buildings
  if (selectedRole === 'billing') {
    return {
      allowedRoles: ['billing'],
      allowedBuildings: null,
    };
  }

  // DON, MDS, Admin: their role only, their building(s) only
  return {
    allowedRoles: [selectedRole],
    allowedBuildings: selectedBuildings.length > 0 ? selectedBuildings : null,
  };
}

// ── Access Gate Component ──
function AccessGate({ onAuthenticated }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState([]);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  const activeBuildings = getActiveBuildings();
  const currentRoleOption = ROLE_OPTIONS.find(r => r.id === selectedRole);

  // Check if already authenticated
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('ihcm_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.userName && session.allowedRoles) {
          onAuthenticated(session);
          return;
        }
      }
    } catch (err) {
      console.warn('[IHCM] Session recovery failed:', err);
    }
    setChecking(false);
  }, []);

  const toggleBuilding = (buildingId) => {
    setSelectedBuildings(prev =>
      prev.includes(buildingId)
        ? prev.filter(b => b !== buildingId)
        : [...prev, buildingId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!code.trim()) { setError('Please enter the access code'); return; }
    if (!selectedRole) { setError('Please select your role'); return; }
    if (currentRoleOption?.needsBuilding && selectedBuildings.length === 0) {
      setError('Please select your building(s)');
      return;
    }

    try {
      const res = await fetch('/api/verify-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        const access = getUserAccess(name.trim(), selectedRole, selectedBuildings);
        const session = {
          userName: name.trim(),
          selectedRole,
          ...access,
        };
        sessionStorage.setItem('ihcm_session', JSON.stringify(session));
        onAuthenticated(session);
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

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '15px', fontFamily: 'inherit',
    boxSizing: 'border-box', marginBottom: '12px',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f9fafb'
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: 'white', padding: '36px', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)', width: '400px', textAlign: 'center'
      }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '600', color: '#1f2937' }}>
          IHCM AI Bot
        </h1>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#6b7280' }}>
          Sign in to get started
        </p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          autoFocus
          style={inputStyle}
        />
        <input
          type="password"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Access code"
          style={inputStyle}
        />

        {/* Role picker */}
        <div style={{ textAlign: 'left', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
            Your role
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ROLE_OPTIONS.map(role => (
              <label key={role.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px',
                border: selectedRole === role.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                backgroundColor: selectedRole === role.id ? '#eff6ff' : 'white',
              }}>
                <input
                  type="radio"
                  name="role"
                  value={role.id}
                  checked={selectedRole === role.id}
                  onChange={() => { setSelectedRole(role.id); setSelectedBuildings([]); }}
                  style={{ accentColor: '#2563eb' }}
                />
                {role.label}
              </label>
            ))}
          </div>
        </div>

        {/* Building picker — only for roles that need it */}
        {currentRoleOption?.needsBuilding && (
          <div style={{ textAlign: 'left', marginBottom: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>
              Your building(s)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {activeBuildings.map(b => (
                <label key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                  border: selectedBuildings.includes(b.id) ? '2px solid #2563eb' : '1px solid #d1d5db',
                  backgroundColor: selectedBuildings.includes(b.id) ? '#eff6ff' : 'white',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedBuildings.includes(b.id)}
                    onChange={() => toggleBuilding(b.id)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  {b.shortName || b.label}
                </label>
              ))}
            </div>
          </div>
        )}

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
  // Access gate — session holds: { userName, selectedRole, allowedRoles, allowedBuildings }
  const [userSession, setUserSession] = useState(null);

  // Feedback state: { [messageIndex]: 'useful' | 'not_useful' | 'wrong' }
  const [feedback, setFeedback] = useState({});
  // Copy-to-clipboard state: tracks which message index was just copied
  const [copiedMsg, setCopiedMsg] = useState(null);
  // Server-side conversation ID (from Supabase, returned by /api/chat)
  const [conversationId, setConversationId] = useState(null);

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

  // Welcome guide state — guarded read for privacy-restricted browsers
  const [seenWelcome, setSeenWelcome] = useState(() => {
    try { return !!localStorage.getItem('ihcm_seen_welcome'); }
    catch { return false; }
  });

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
    setConversationId(null);
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

  // Copy message content to clipboard
  const handleCopy = async (msgIndex, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsg(msgIndex);
      setTimeout(() => setCopiedMsg(null), 2000);
    } catch (err) {
      console.warn('[IHCM] Copy to clipboard failed:', err);
    }
  };

  // Format inline markdown (bold, links)
  const formatInline = (text, lineKey) => {
    // Process bold and links in one pass
    const parts = [];
    let remaining = text;
    let partIdx = 0;

    while (remaining.length > 0) {
      // Find the next bold or link
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      let nextMatch = null;
      let nextType = null;

      if (boldMatch && (!linkMatch || boldMatch.index <= linkMatch.index)) {
        nextMatch = boldMatch;
        nextType = 'bold';
      } else if (linkMatch) {
        nextMatch = linkMatch;
        nextType = 'link';
      }

      if (!nextMatch) {
        parts.push(remaining);
        break;
      }

      // Text before the match
      if (nextMatch.index > 0) {
        parts.push(remaining.slice(0, nextMatch.index));
      }

      if (nextType === 'bold') {
        parts.push(<strong key={`${lineKey}-b${partIdx++}`}>{nextMatch[1]}</strong>);
      } else if (nextType === 'link') {
        const href = nextMatch[2];
        // Only allow safe protocols — reject javascript:, data:, vbscript:, etc.
        const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#');
        if (isSafe) {
          parts.push(
            <a key={`${lineKey}-a${partIdx++}`} href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}>
              {nextMatch[1]}
            </a>
          );
        } else {
          // Render as plain text if URL is unsafe
          parts.push(nextMatch[1]);
        }
      }

      remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
  };

  // Classify a line as 'ul', 'ol', or null (not a list item)
  const getListType = (line) => {
    if (/^\s*\d+[\.\)]\s/.test(line)) return 'ol';
    if (line.trim().startsWith('-') || line.trim().startsWith('* ')) return 'ul';
    return null;
  };

  // Extract text content from a list item line
  const getListItemText = (line, type) => {
    if (type === 'ol') return line.replace(/^\s*\d+[\.\)]\s/, '');
    if (line.trim().startsWith('-')) return line.replace(/^\s*-\s*/, '');
    return line.replace(/^\s*\*\s/, '');
  };

  // Format markdown-like content — groups consecutive list items into <ul>/<ol>
  const formatContent = (content) => {
    const lines = content.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks (```)
      if (line.trim().startsWith('```')) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        result.push(
          <pre key={`code-${i}`} style={{
            backgroundColor: '#1f2937', color: '#e5e7eb', padding: '12px 16px',
            borderRadius: '6px', fontSize: '13px', overflowX: 'auto',
            fontFamily: 'monospace', margin: '8px 0', lineHeight: '1.5',
          }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        i++; // skip closing ```
        continue;
      }

      // Headers (##)
      if (line.startsWith('##')) {
        result.push(
          <h3 key={`h3-${i}`} className="ihcm-message-header">
            {formatInline(line.replace(/^##\s*/, ''), `h3-${i}`)}
          </h3>
        );
        i++;
        continue;
      }

      // Collect consecutive list items into a proper <ul> or <ol>
      const listType = getListType(line);
      if (listType) {
        const items = [];
        const startIdx = i;
        while (i < lines.length && getListType(lines[i]) === listType) {
          items.push(
            <li key={`li-${i}`} className="ihcm-message-bullet">
              {formatInline(getListItemText(lines[i], listType), `li-${i}`)}
            </li>
          );
          i++;
        }
        const ListTag = listType === 'ol' ? 'ol' : 'ul';
        result.push(
          <ListTag key={`${listType}-${startIdx}`} style={{ margin: '4px 0', paddingLeft: '24px' }}>
            {items}
          </ListTag>
        );
        continue;
      }

      if (line.trim() === '') {
        result.push(<div key={`empty-${i}`} className="ihcm-message-spacing" />);
      } else {
        result.push(
          <p key={`p-${i}`} className="ihcm-message-text">
            {formatInline(line, `line-${i}`)}
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

        {/* New Chat button — pushed to the right */}
        <div style={{ marginLeft: 'auto' }}>
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
