// ============================================================================
// Local conversation persistence
// ============================================================================
// Stores conversation history per role+building combo in localStorage.
// Pre-auth scaffold — server-side persistence deferred to next layer.

const STORAGE_KEY = 'ihcm_bot_conversations';
const MAX_STORED_MESSAGES = 50;

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function makeKey(roleId, buildingId) {
  return `${roleId}::${buildingId || 'none'}`;
}

export function loadMessages(roleId, buildingId) {
  const store = getStore();
  return store[makeKey(roleId, buildingId)] || [];
}

export function saveMessages(roleId, buildingId, messages) {
  const store = getStore();
  store[makeKey(roleId, buildingId)] = messages.slice(-MAX_STORED_MESSAGES);
  saveStore(store);
}

export function clearMessages(roleId, buildingId) {
  const store = getStore();
  delete store[makeKey(roleId, buildingId)];
  saveStore(store);
}

export function clearAllMessages() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
