/**
 * voiceService.js
 */

let recognition    = null;
let synth          = window.speechSynthesis;
let onResultCb     = null;
let isListening    = false;
let onSpeakStartCb = null;
let onSpeakEndCb   = null;


const GOOGLE_TTS_KEY = ''; 
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';


const VOICE_SETTINGS = {
  rate:   0.45,  
  pitch:  1.5,  
  volume: 0.7,
  lang:   'en-AU' 
};


const PREFERRED_VOICES = [
  'Karen',    
  'Siri',      
  'Daniel',   
  'Samantha',  
  'Tessa',    
  'Moira',   
  'Veena'     
];

function getDefaultVoice() {
  const voices = synth.getVoices();
  console.log('[Voice] Available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
  
  if (!voices.length) return null;
  
  // Specifically look for Karen first
  const karen = voices.find(v => v.name === 'Karen');
  if (karen) {
    console.log('[Voice] Found Karen voice:', karen.name, '-', karen.lang);
    return karen;
  }
  
  // Try other preferred Mac voices
  for (const preferred of PREFERRED_VOICES.slice(1)) { 
    const voice = voices.find(v => v.name === preferred);
    if (voice) {
      console.log('[Voice] Using preferred voice:', voice.name, '-', voice.lang);
      return voice;
    }
  }
  
  // Fallback to any English voice
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  console.log('[Voice] Karen not found, using:', englishVoice?.name || 'default voice');
  return englishVoice || voices[0];
}

/* Google TTS */

export async function speak(text) {
  // Clean text for TTS
  const clean = text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[_~]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return;

  // Use Mac character voices
  speakBrowser(clean);
}

/* Browser Fallback */

function speakBrowser(text) {
  if (!synth) return;
  synth.cancel();

  const utterance  = new SpeechSynthesisUtterance(text);
  utterance.rate   = VOICE_SETTINGS.rate;
  utterance.pitch  = VOICE_SETTINGS.pitch;
  utterance.volume = VOICE_SETTINGS.volume;

  // Force Karen voice for Safari
  const voices = synth.getVoices();
  console.log('[Voice] Total voices available:', voices.length);
  
  if (voices.length > 0) {
    // Try multiple ways to set Karen voice
    let karenVoice = voices.find(v => v.name === 'Karen');
    
    if (karenVoice) {
      utterance.voice = karenVoice;
      utterance.lang = karenVoice.lang;
      console.log('[Voice] Successfully set Karen voice');
    } else {
      console.log('[Voice] Karen voice not found in voices list');
      // Fallback to any voice
      utterance.voice = voices[0];
    }
    
    console.log('[Voice] Final voice selection:', utterance.voice?.name);
  } else {
    console.log('[Voice] No voices loaded yet');
    synth.addEventListener('voiceschanged', () => {
      let karenVoice = synth.getVoices().find(v => v.name === 'Karen');
      if (karenVoice) {
        utterance.voice = karenVoice;
        utterance.lang = karenVoice.lang;
        console.log('[Voice] Set Karen voice on voiceschanged');
      }
      synth.speak(utterance);
    }, { once: true });
    return;
  }

  utterance.onstart = () => { 
    console.log('[Voice] Speech started with voice:', utterance.voice?.name, 'rate:', utterance.rate, 'pitch:', utterance.pitch);
    if (onSpeakStartCb) onSpeakStartCb(); 
  };
  utterance.onend   = () => { 
    console.log('[Voice] Speech ended');
    if (onSpeakEndCb) onSpeakEndCb();   
  };
  utterance.onerror = (e) => console.warn('[Voice] Browser speak error:', e.error);

  console.log('[Voice] Speaking with:', utterance.voice?.name);
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (synth) synth.cancel();
  if (onSpeakEndCb) onSpeakEndCb();
}

export function isSpeaking() {
  return synth ? synth.speaking : false;
}

/* Speech Recognition (input)  */

export function initVoiceInput(onResult) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[Voice] Speech recognition not supported');
    return false;
  }

  onResultCb  = onResult;
  recognition = new SpeechRecognition();
  recognition.lang            = 'en-US';
  recognition.interimResults  = false;
  recognition.maxAlternatives = 1;
  recognition.continuous      = false;

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    if (onResultCb) onResultCb(transcript);
  };

  recognition.onerror = (e) => {
    console.warn('[Voice] Recognition error:', e.error);
    isListening = false;
    document.getElementById('btn-mic')?.classList.remove('listening');
  };

  recognition.onend = () => {
    isListening = false;
    document.getElementById('btn-mic')?.classList.remove('listening');
  };

  return true;
}

export function startListening() {
  if (!recognition || isListening) return;
  try {
    recognition.start();
    isListening = true;
  } catch (e) {
    console.warn('[Voice] Could not start recognition:', e);
  }
}

export function stopListening() {
  if (!recognition || !isListening) return;
  try { recognition.stop(); isListening = false; } catch (e) {}
}

export function isCurrentlyListening() { return isListening; }

export function onSpeakStart(cb) { onSpeakStartCb = cb; }
export function onSpeakEnd(cb)   { onSpeakEndCb   = cb; }

/* ─── Lip sync helper ─── */
export function getLipSyncValue() {
  return synth && synth.speaking ? 0.4 + Math.random() * 0.6 : 0;
}
