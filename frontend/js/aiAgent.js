/**
 * aiAgent.js
 * This file assembles context (memory, RAG, agent hints) and owns history.
 */

import { buildMemoryContext, getHistory, addToHistory } from './memoryService.js';
import { planTask, executeTask }                         from './agentSystem.js';
import { detectEmotion }                                from './emotionEngine.js';
import { getProfile }                                   from './memoryService.js';
//  Upgrade additions (v2) 
import { retrieveContext }   from './ragService.js';
import { planTaskV2 }        from './plannerAgent.js';
import { executeTaskV2 }     from './executorAgent.js';

/*  Backend URL 
   The Python FastAPI backend handles all Gemini / Ollama calls.     */
const BACKEND_URL = 'http://localhost:8000';

/*  System persona  */
const ARIA_PERSONA = `You are ARIA (Adaptive Responsive Intelligent Agent), a friendly and intelligent AI avatar assistant.
Your personality:
- Warm, encouraging, and supportive
- Clear and concise — you don't ramble
- Smart but approachable — you explain things at the right level
- You remember the user's name and goals across conversations
- You can help with: learning, planning, questions, explanations, quizzes, study plans
- If you don't know something, say so honestly
- Keep responses under 120 words unless it's a quiz or study plan
- Do NOT use excessive markdown — keep formatting clean and readable`;

/**
 * Main AI call.
 * @param {string} userMsg    - Raw user message
 * @param {string} [apiKey]   - Ignored (key now lives in backend/.env). Kept for call-site compatibility.
 * @returns {Promise<{ text, emotion, uiAction }>}
 */
export async function askAI(userMsg, apiKey) {
  // 1. Detect emotion
  const emotion = detectEmotion(userMsg);

  // 2. Plan task — use v2 planner (enhanced), keep v1 as backup
  const profile  = getProfile();
  const planV2   = planTaskV2(userMsg);
  const resultV2 = await executeTaskV2(planV2, profile);
  // v1 fallback (for backward compat — executeTask is synchronous)
  const plan     = planTask(userMsg);
  const result   = resultV2.handled ? resultV2 : executeTask(plan, profile);

  // 3. Build context — memory + RAG
  const memCtx  = buildMemoryContext();
  const ragCtx  = await retrieveContext(userMsg);      // ← NEW: RAG retrieval
  const history = getHistory();

  // 4. Build system prompt
  let systemPrompt = ARIA_PERSONA;
  if (memCtx)            systemPrompt += `\n\nWhat you know about the user:\n${memCtx}`;
  if (ragCtx)            systemPrompt += `\n\nRelevant context retrieved:\n${ragCtx}`;   // ← NEW
  if (result.systemHint) systemPrompt += `\n\nTask instruction:\n${result.systemHint}`;
  systemPrompt += `\n\nUser's current emotion: ${emotion.label}. Respond appropriately.`;

  // 5. Build message history (max 8 turns — sent to backend as plain objects)
  const recentHistory = history.slice(-8).map(h => ({
    role:    h.role,   // "user" | "assistant"
    content: h.content
  }));

  // 6. Send to Python backend
  try {
    const useOffline = localStorage.getItem('aria_prefer_offline') === 'true';

    const response = await fetch(`${BACKEND_URL}/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMsg,
        systemPrompt,
        history:    recentHistory,
        useOffline,
      })
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { detail = (await response.json()).detail ?? detail; } catch {}
      throw new Error(detail);
    }

    const data = await response.json();
    const text = data.text ?? 'Sorry, I had trouble responding.';

    // 7. Store in history (browser-side — unchanged)
    addToHistory('user',      userMsg);
    addToHistory('assistant', text);

    console.log(`[AI] answered by backend (source: ${data.source})`);
    return { text, emotion, uiAction: result.uiAction };

  } catch (err) {
    // Graceful fallback: if backend is unreachable, use local demo mode
    if (err instanceof TypeError && err.message.includes('fetch')) {
      console.warn('[AI] Backend unreachable — falling back to demo mode');
      const demoReply = getDemoReply(userMsg, profile, plan);
      addToHistory('user',      userMsg);
      addToHistory('assistant', demoReply);
      return { text: demoReply, emotion, uiAction: result.uiAction };
    }
    console.error('[AI] Backend error:', err);
    throw err;
  }
}

/* Demo mode responses (no API key)  */
function getDemoReply(msg, profile, plan) {
  const name = profile.name ? `, ${profile.name}` : '';
  const lower = msg.toLowerCase();

  if (plan.type === 'quiz')
    return `Here's a sample question${name}:\nQ1. What does HTML stand for?\nA) HyperText Markup Language\nB) High Transfer Mode Link\nC) HyperText Medium Language\nD) None of these\nAnswer: A`;

  if (plan.type === 'study_plan')
    return `Here's a quick plan${name}:\n**Week 1:** Basics & fundamentals\n**Week 2:** Core concepts with projects\n**Week 3:** Advanced topics\n**Week 4:** Build something real!\n\n(Connect a Gemini API key for a full personalised plan!)`;

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey'))
    return `Hello${name}! I'm ARIA, your AI avatar assistant. I'm running in demo mode right now. Add your Gemini API key in the settings to unlock full AI!`;

  if (lower.includes('your name') || lower.includes('who are you'))
    return `I'm ARIA — Adaptive Responsive Intelligent Agent. I can help you learn, plan, answer questions, and more. Get your free Gemini API key at aistudio.google.com to see my full capabilities!`;

  return `I'm ARIA in demo mode${name}. I heard: "${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}". Connect a Gemini API key for real AI responses!`;
}
