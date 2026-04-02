/**
 * memoryService.js
 */

const MEMORY_KEY   = 'aria_memory';
const HISTORY_KEY  = 'aria_history';
const PROFILE_KEY  = 'aria_profile';
const MAX_HISTORY  = 20;   
const MAX_MEMORIES = 50;  
/* Core memory store  */

export function saveMemory(key, value) {
  const store = getAllMemories();
  store[key] = {
    value,
    timestamp: Date.now(),
    key
  };
  localStorage.setItem(MEMORY_KEY, JSON.stringify(store));
}

export function getMemory(key) {
  const store = getAllMemories();
  return store[key]?.value ?? null;
}

export function getAllMemories() {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
  } catch {
    return {};
  }
}

export function clearAllMemories() {
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

/*  Conversation history  */

export function addToHistory(role, content) {
  const history = getHistory();
  history.push({ role, content, timestamp: Date.now() });
  // Keep only last N messages
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

/*  User profile */

export function saveProfile(updates) {
  const profile = getProfile();
  Object.assign(profile, updates);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
  } catch {
    return {};
  }
}

/* Smart memory injection 
*/
export function buildMemoryContext() {
  const profile  = getProfile();
  const memories = getAllMemories();

  const parts = [];

  if (profile.name)     parts.push(`User's name: ${profile.name}`);
  if (profile.goal)     parts.push(`User's current goal: ${profile.goal}`);
  if (profile.topic)    parts.push(`User is studying: ${profile.topic}`);
  if (profile.level)    parts.push(`Skill level: ${profile.level}`);

  const memVals = Object.values(memories)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(m => `${m.key}: ${m.value}`);

  if (memVals.length) parts.push('Known facts:\n' + memVals.join('\n'));

  return parts.length ? parts.join('\n') : '';
}

/* Auto-extract facts from conversation 
*/
export function autoExtractFacts(userMsg, aiMsg) {
  const lower = userMsg.toLowerCase();

  // Name detection
  const nameMatch = lower.match(/(?:my name is|i(?:'m| am) called|call me)\s+([a-z]+)/i);
  if (nameMatch) {
    const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
    saveProfile({ name });
    saveMemory('user_name', name);
  }

  // Goal detection
  const goalMatch = lower.match(/(?:i want to|my goal is to|i(?:'m| am) trying to|i(?:'d| would) like to)\s+(.+?)(?:\.|$)/i);
  if (goalMatch) {
    saveProfile({ goal: goalMatch[1].trim() });
    saveMemory('user_goal', goalMatch[1].trim());
  }

  // Learning topic detection
  const learnMatch = lower.match(/(?:learning|studying|working on|exploring)\s+(.+?)(?:\s+(?:and|or|,)|\.?$)/i);
  if (learnMatch) {
    const topic = learnMatch[1].trim();
    if (topic.length < 50) {
      saveProfile({ topic });
      saveMemory('current_topic', topic);
    }
  }

  // Level detection
  if (lower.includes('beginner') || lower.includes("i'm new to")) saveProfile({ level: 'beginner' });
  if (lower.includes('intermediate')) saveProfile({ level: 'intermediate' });
  if (lower.includes('advanced') || lower.includes('expert')) saveProfile({ level: 'advanced' });
}


/*  RAG: Semantic-style memory search 
*/

/**
 * Search memories by relevance to a query string.
 * @param {string} query     
 * @param {number} topN       
 * @returns {Array<{key, value, score}>}
 */
export function searchMemory(query, topN = 5) {
  if (!query) return [];
  const tokens = tokenize(query);
  const store  = getAllMemories();
  const profile = getProfile();

  // Combine memories + profile into searchable entries
  const entries = [
    ...Object.values(store).map(m => ({ key: m.key, value: String(m.value), timestamp: m.timestamp || 0 })),
    ...Object.entries(profile).map(([k, v]) => ({ key: `profile_${k}`, value: String(v), timestamp: 0 }))
  ];

  const scored = entries
    .map(entry => {
      const entryTokens = tokenize(entry.key + ' ' + entry.value);
      const overlap = tokens.filter(t => entryTokens.includes(t)).length;
      const score   = overlap / Math.max(tokens.length, 1);
      return { ...entry, score };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .slice(0, topN);

  return scored;
}

function tokenize(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}
