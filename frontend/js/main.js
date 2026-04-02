/**
 * main.js
 connects everything together.
 */

import {
  initScene, loadVRM, loadPlaceholderAvatar,
  setLipSyncCallback, setPlaceholderRef,
  triggerExpression, enableARCamera, disableARCamera,
  toggleAnim,
  startCyclicAnim,
  stopCyclicAnim,
  playAnimSequence,
  stopAnim,
  currentAnim
} from './sceneAR.js';

import {
  initVoiceInput, startListening, stopListening,
  isCurrentlyListening, speak, onSpeakStart, onSpeakEnd, getLipSyncValue
} from './voiceService.js';

import {
  addMessage, addTypingIndicator, removeTypingIndicator,
  clearChat, setStatus, setLoaderStatus, hideLoader,
  showEmotionBadge, showToast, setupNavigation
} from './uiController.js';

import { askAI }                                from './aiAgent.js';
import { detectEmotion, emotionToVRM }          from './emotionEngine.js';
import { autoExtractFacts, getMemory, saveMemory, getProfile } from './memoryService.js';
// Upgrade additions
import { initEmotionReactor, reactToEmotion }   from './emotionReactor.js';
import { seedDefaultKnowledge }                 from './knowledgeBase.js';

/*  App State  */
const state = {
  apiKey:     '',
  arMode:     false,
  vrmLoaded:  false,
  placeholder: null,
  speaking:   false
};

/* INIT */
async function init() {
  setLoaderStatus('Setting up 3D scene…');

  // Init Three.js
  const canvas = document.getElementById('ar-canvas');
  initScene(canvas);

  setLoaderStatus('Loading avatar…');
  await loadAvatar();

  setLoaderStatus('Starting voice systems…');
  setupVoice();

  setLoaderStatus('Building UI…');
  setupUI();

  setLoaderStatus('Ready!');
  await sleep(600);
  hideLoader();

  seedDefaultKnowledge().catch(e => console.warn('[Main] KB seed error:', e));

  initEmotionReactor({
    triggerExpressionFn: triggerExpression,
    playAnimSequenceFn:  playAnimSequence,
    showToastFn:         showToast,
    vrmLoadedFn:         () => state.vrmLoaded
  });

  fetch('http://localhost:8000/health')
    .then(r => r.json())
    .then(() => { setStatus('online', 'Connected'); })
    .catch(() => { setStatus('', 'Demo mode'); })
    .finally(() => greetUser());
}

/*Avatar Loading  */

async function loadAvatar() {
  try {
    const vrmUrl = 'models/avatar.vrm';
    const resp   = await fetch(vrmUrl, { method: 'HEAD' });
    if (resp.ok) {
      setLoaderStatus('Loading VRM model…');
      await loadVRM(vrmUrl, pct => setLoaderStatus(`Loading VRM… ${pct}%`));
      state.vrmLoaded = true;
    } else {
      throw new Error('No VRM');
    }
  } catch {
    console.log('[Main] No VRM found — using placeholder avatar');
    const ph = loadPlaceholderAvatar();
    state.placeholder = ph;
    setPlaceholderRef(ph);
  }

  // Wire lip sync
  setLipSyncCallback(getLipSyncValue);
}

/* Voice Setup */

function setupVoice() {
  const ok = initVoiceInput((transcript) => {
    document.getElementById('chat-input').value = transcript;
    handleSend();
  });

  if (!ok) console.warn('[Main] Voice input unavailable');

  onSpeakStart(() => {
    state.speaking = true;
    // Trigger talking expression
    if (state.vrmLoaded) triggerExpression('happy', 999999); 
  });

  onSpeakEnd(() => {
    state.speaking = false;
    if (state.vrmLoaded) {
      triggerExpression('neutral', 0);
      // Trigger animation sequence after answering
      setTimeout(() => playAnimSequence(['relax', 'jump']), 500); 
    }
  });
}

/*  UI Setup */

function setupUI() {
  // Navigation
  setupNavigation((panel) => {
    // When user opens avatar panel, hide other panels
  });

  // Send button
  document.getElementById('btn-send')?.addEventListener('click', handleSend);

  // Enter key in input
  document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  // Mic button
  const micBtn = document.getElementById('btn-mic');
  micBtn?.addEventListener('click', () => {
    if (isCurrentlyListening()) {
      stopListening();
      micBtn.classList.remove('listening');
    } else {
      startListening();
      micBtn.classList.add('listening');
      showToast('🎤 Listening…');
      // Auto stop after 8s
      setTimeout(() => micBtn.classList.remove('listening'), 8000);
    }
  });

  // AR button
  document.getElementById('btn-ar')?.addEventListener('click', toggleAR);

  // Clear chat
  document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
    clearChat();
    showToast('Chat cleared');
  });

  // Expression controls
  document.getElementById('btn-wave')?. addEventListener('click', () => {
    if (state.vrmLoaded) triggerExpression('happy', 2000);
    showToast('Waving!');
  });
  document.getElementById('btn-smile')?.addEventListener('click', () => {
    if (state.vrmLoaded) triggerExpression('happy', 3000);
    showToast('Smiling!');
  });
  document.getElementById('btn-think')?.addEventListener('click', () => {
    if (state.vrmLoaded) triggerExpression('relaxed', 3000);
    showToast('Thinking…');
  });
  document.getElementById('btn-walk')?.addEventListener('click', () => {
    toggleWalking();
    const btn = document.getElementById('btn-walk');
    btn.classList.toggle('active');
    showToast(btn.classList.contains('active') ? ' Walking!' : ' Standing');
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (state.vrmLoaded) triggerExpression('neutral', 0);
    showToast('Reset expression');
  });

  // Animation controls
  document.getElementById('btn-jump')?.addEventListener('click', () => {
    toggleAnim('jump');
    showToast('Jumping!');
  });
  document.getElementById('btn-relax')?.addEventListener('click', () => {
    if (currentAnim() === 'relax') {
      stopCyclicAnim();
      showToast('Relax stopped');
    } else {
      startCyclicAnim('relax', 60000); // 60 seconds pause
      showToast(' Relaxing (cyclic every 1 min)');
    }
  });
  document.getElementById('btn-clapping')?.addEventListener('click', () => {
    toggleAnim('clapping');
    showToast(' Clapping!');
  });

  // Config modal
  document.getElementById('btn-save-key')?.addEventListener('click', saveAPIKey);
  document.getElementById('btn-skip-key')?.addEventListener('click', () => {
    document.getElementById('config-modal')?.classList.add('modal-hidden');
    setStatus('', 'Demo mode');
    greetUser();
  });

  // Prefill if key exists
  if (state.apiKey) {
    const inp = document.getElementById('api-key-input');
    if (inp) inp.value = state.apiKey;
  }
}

/* Send Message */

async function handleSend() {
  const input = document.getElementById('chat-input');
  const msg   = input?.value.trim();
  if (!msg) return;

  input.value = '';

 
  addMessage('user', msg, 'You');

  autoExtractFacts(msg, '');

  // Detect + show emotion
  const emotion = detectEmotion(msg);
  showEmotionBadge(emotion);

  reactToEmotion(emotion);
  if (state.vrmLoaded && !emotion.confidence) {
    const vrmExpr = emotionToVRM(emotion.emotion);
    triggerExpression(vrmExpr, 3000);
  }

  // Show typing
  setStatus('thinking', 'Thinking…');
  const typingEl = addTypingIndicator();

  try {
    const { text, uiAction } = await askAI(msg, state.apiKey);

    removeTypingIndicator();

    // Handle special UI actions
    if (uiAction === 'memory_saved')    showToast('💾 Memory saved!');
    if (uiAction === 'knowledge_saved') showToast('📚 Added to knowledge base!');

    // Show AI response
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addMessage('aria', text, `ARIA · ${timestamp}`);

    // Auto-extract from AI response too
    autoExtractFacts(msg, text);

    // Speak response
    speak(text);

    setStatus('online', 'Connected');

  } catch (err) {
    removeTypingIndicator();
    const errMsg = err.message?.includes('API_KEY') || err.message?.includes('400')
      ? 'Invalid API key. Please check your key in settings.'
      : `Error: ${err.message}. Check your internet connection.`;

    addMessage('aria', errMsg);
    setStatus('', 'Error');
    showToast('' + errMsg.slice(0, 50));
  }
}

/*  AR Toggle */

async function toggleAR() {
  const btn = document.getElementById('btn-ar');
  if (!state.arMode) {
    const ok = await enableARCamera();
    if (ok) {
      state.arMode = true;
      document.body.classList.add('ar-mode');
      btn?.classList.add('active');
      showToast('📷 AR Camera enabled');
    } else {
      showToast(' Camera access denied');
    }
  } else {
    disableARCamera();
    state.arMode = false;
    document.body.classList.remove('ar-mode');
    btn?.classList.remove('active');
    showToast('AR Camera off');
  }
}

/* API Key  */

function saveAPIKey() {
  const inp = document.getElementById('api-key-input');
  const key = inp?.value.trim();

  if (!key || !key.startsWith('AIza')) {
    showToast('Invalid key format (should start with AIza…)');
    return;
  }

  state.apiKey = key;
  localStorage.setItem('aria_api_key', key);
  document.getElementById('config-modal')?.classList.add('modal-hidden');
  setStatus('online', 'Connected');
  showToast('API key saved!');
  greetUser();
}

/*  Greeting  */

function greetUser() {
  const profile = getProfile();
  const name    = profile.name ? `, ${profile.name}` : '';
  const hour    = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const msg = state.apiKey
    ? `${greeting}${name}! I'm ARIA, your AI avatar assistant. I can help you learn, plan, answer questions, and more. What's on your mind?`
    : `${greeting}${name}! I'm ARIA, running in demo mode. Add your Gemini API key to unlock full AI! You can try chatting with me — type anything below.`;

  addMessage('aria', msg, `ARIA · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  speak(msg);
}

/*  Helpers */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* Boot  */
window.addEventListener('DOMContentLoaded', init);
