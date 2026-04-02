/**
 * ollamaAgent.js 
 * Offline LLM integration wrapper.
 */

const OLLAMA_BASE   = 'http://localhost:11434';
const GPT4ALL_BASE  = 'http://localhost:4891';

// Preferred model 
const OLLAMA_MODEL_PREFS = [
  'llama3.2',
  'llama3',
  'llama2',
  'mistral',
  'phi3',
  'gemma2',
  'gemma',
  'qwen2',
  'tinyllama'
];

/*  Availability check  */

let _ollamaAvailable  = null;  
let _gpt4allAvailable = null;
let _ollamaModel      = null;

/**
 * Check if Ollama is running locally.
 * @returns {Promise<boolean>}
 */
export async function isOllamaAvailable() {
  if (_ollamaAvailable !== null) return _ollamaAvailable;

  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(1500)    
    });
    if (!resp.ok) { _ollamaAvailable = false; return false; }

    const data   = await resp.json();
    const models = (data.models || []).map(m => m.name.split(':')[0].toLowerCase());

    // Pick best available model
    for (const pref of OLLAMA_MODEL_PREFS) {
      if (models.some(m => m.includes(pref))) {
        _ollamaModel = models.find(m => m.includes(pref));
        break;
      }
    }
    // If nothing matched prefs, just use whatever is installed
    if (!_ollamaModel && models.length) _ollamaModel = models[0];

    _ollamaAvailable = !!_ollamaModel;
    console.log('[Ollama] Available:', _ollamaAvailable, '| Model:', _ollamaModel);

    // Reset cache after 60s
    setTimeout(() => { _ollamaAvailable = null; _ollamaModel = null; }, 60_000);

    return _ollamaAvailable;
  } catch {
    _ollamaAvailable = false;
    setTimeout(() => { _ollamaAvailable = null; }, 30_000);
    return false;
  }
}

/**
 * Check if GPT4All API server is running locally.
 * @returns {Promise<boolean>}
 */
export async function isGPT4AllAvailable() {
  if (_gpt4allAvailable !== null) return _gpt4allAvailable;

  try {
    const resp = await fetch(`${GPT4ALL_BASE}/v1/models`, {
      signal: AbortSignal.timeout(1500)
    });
    _gpt4allAvailable = resp.ok;
    setTimeout(() => { _gpt4allAvailable = null; }, 60_000);
    console.log('[GPT4All] Available:', _gpt4allAvailable);
    return _gpt4allAvailable;
  } catch {
    _gpt4allAvailable = false;
    setTimeout(() => { _gpt4allAvailable = null; }, 30_000);
    return false;
  }
}

/**
 * Check if ANY offline LLM is available.
 * @returns {Promise<'ollama'|'gpt4all'|null>}
 */
export async function detectOfflineLLM() {
  const [ollama, gpt4all] = await Promise.all([isOllamaAvailable(), isGPT4AllAvailable()]);
  if (ollama)  return 'ollama';
  if (gpt4all) return 'gpt4all';
  return null;
}

/*  Inference  */

/**

 *
 * @param {string} systemPrompt  
 * @param {string} userMessage  
 * @param {number} [maxTokens]   
 * @returns {Promise<string|null>}  
 */
export async function askOfflineLLM(systemPrompt, userMessage, maxTokens = 300) {
  // Try Ollama
  if (await isOllamaAvailable()) {
    try {
      const text = await _ollamaChat(systemPrompt, userMessage, maxTokens);
      if (text) return text;
    } catch (e) {
      console.warn('[Ollama] Chat failed:', e.message);
    }
  }

  // Try GPT4All
  if (await isGPT4AllAvailable()) {
    try {
      const text = await _gpt4allChat(systemPrompt, userMessage, maxTokens);
      if (text) return text;
    } catch (e) {
      console.warn('[GPT4All] Chat failed:', e.message);
    }
  }

  return null; 
}

/*  Ollama API  */

async function _ollamaChat(system, user, maxTokens) {
  const body = {
    model:  _ollamaModel,
    stream: false,
    options: { num_predict: maxTokens, temperature: 0.75 },
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ]
  };

  const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30_000)   
  });

  if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);

  const data = await resp.json();
  return data?.message?.content?.trim() || null;
}

/*  GPT4All API (OpenAI-compatible) */

async function _gpt4allChat(system, user, maxTokens) {
  const body = {
    model:       'gpt4all-falcon',
    max_tokens:  maxTokens,
    temperature: 0.75,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user }
    ]
  };

  const resp = await fetch(`${GPT4ALL_BASE}/v1/chat/completions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30_000)
  });

  if (!resp.ok) throw new Error(`GPT4All HTTP ${resp.status}`);

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

/* Status helper for UI  */

/**
 * Get a human-readable offline LLM status string.
 * @returns {Promise<string>}
 */
export async function getOfflineLLMStatus() {
  const provider = await detectOfflineLLM();
  if (provider === 'ollama')  return `Ollama (${_ollamaModel || 'local'})`;
  if (provider === 'gpt4all') return 'GPT4All (local)';
  return 'Not available';
}
