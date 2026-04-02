/**
 * knowledgeBase.js 
 * Local knowledge base using IndexedDB.
 */

const DB_NAME    = 'aria_kb';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

/*  IndexedDB bootstrap  */

let _db = null;

async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db    = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title',     'title',     { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* CRUD  */

/**
 * Add a knowledge entry.
 * @param {string} title    - Short label (e.g. 'Python Loops')
 * @param {string} content  - The knowledge text
 * @param {string} [tag]    - Optional category tag
 * @returns {Promise<number>} - New entry ID
 */
export async function addKnowledge(title, content, tag = 'general') {
  const db    = await getDB();
  const entry = { title, content, tag, timestamp: Date.now(), tokens: tokenize(title + ' ' + content) };
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Get all knowledge entries.
 * @returns {Promise<Array>}
 */
export async function getAllKnowledge() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Delete a knowledge entry by ID.
 * @param {number} id
 */
export async function deleteKnowledge(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Clear all knowledge entries.
 */
export async function clearKnowledge() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/* Search  */

/**
 *
 * @param {string} query
 * @param {number} topN
 * @returns {Promise<Array<{id, title, content, score}>>}
 */
export async function searchKnowledge(query, topN = 5) {
  if (!query) return [];

  const entries    = await getAllKnowledge();
  const queryToks  = tokenize(query);
  if (!queryToks.length) return [];

  const scored = entries
    .map(entry => {
      const entryToks = entry.tokens || tokenize(entry.title + ' ' + entry.content);
      const overlap   = queryToks.filter(t => entryToks.includes(t)).length;
      const score     = overlap / Math.max(queryToks.length, 1);
      // Truncate content to keep context manageable
      const snippet   = entry.content.length > 200
        ? entry.content.slice(0, 197) + '…'
        : entry.content;
      return { id: entry.id, title: entry.title, content: snippet, score, tag: entry.tag };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scored;
}

/* Seed with default knowledge */

/**
 */
export async function seedDefaultKnowledge() {
  const existing = await getAllKnowledge();
  if (existing.length > 0) return;   // Already seeded

  const defaults = [
    {
      title: 'About ARIA',
      content: 'ARIA stands for Adaptive Responsive Intelligent Agent. ARIA is a web-based AR AI avatar assistant that runs in the browser. ARIA can chat, answer questions, generate quizzes, create study plans, and remember user information.',
      tag: 'system'
    },
    {
      title: 'How to use voice input',
      content: 'Click the microphone button to start voice input. Speak clearly and ARIA will transcribe your words. Voice input works in Chrome and Edge browsers. You need to allow microphone permission.',
      tag: 'help'
    },
    {
      title: 'How to enable AR mode',
      content: 'Click the camera icon in the top bar to enable AR mode. Your device camera will show the real world behind the avatar. AR mode requires HTTPS or localhost and camera permission.',
      tag: 'help'
    },
    {
      title: 'Memory and learning',
      content: 'ARIA remembers your name, learning goals, and topics. Tell ARIA your name by saying "my name is..." or your goal by saying "I want to learn...". ARIA stores these in browser localStorage.',
      tag: 'help'
    },
    {
      title: 'API key setup',
      content: 'ARIA uses Google Gemini API for AI responses. Get a free API key from aistudio.google.com. The key starts with AIza. Without a key, ARIA runs in demo mode with limited responses.',
      tag: 'help'
    },
    {
      title: 'Avatar expressions and animations',
      content: 'ARIA supports happy, sad, angry, surprised, relaxed, and neutral expressions. Expressions are triggered automatically based on detected emotions. You can also manually trigger expressions using the control buttons.',
      tag: 'system'
    }
  ];

  for (const entry of defaults) {
    await addKnowledge(entry.title, entry.content, entry.tag);
  }
  console.log('[KB] Seeded default knowledge entries:', defaults.length);
}

/* Tokenizer (shared with ragService) */
function tokenize(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}
