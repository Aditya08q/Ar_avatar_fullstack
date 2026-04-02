/**
 * emotionEngine.js
 * Detects emotion from text and maps it to VRM blendshape expressions.
 */

/* Emotion keywords dictionary */
const EMOTION_MAP = {
  happy: {
    keywords: ['happy','great','awesome','love','yay','excited','amazing','wonderful','thank','thanks','fantastic','good news','cool','nice','yes!','woohoo','haha','lol','😊','😄','🎉'],
    vrm: 'happy',
    emoji: '😊',
    label: 'Happy',
    color: '#22c55e'
  },
  sad: {
    keywords: ['sad','sorry','miss','alone','depressed','unhappy','bad','terrible','awful','fail','failed','lost','cry','crying','😢','😭',':('],
    vrm: 'sad',
    emoji: '😢',
    label: 'Sad',
    color: '#60a5fa'
  },
  angry: {
    keywords: ['angry','mad','hate','furious','annoyed','frustrated','stupid','idiot','ugh','why!!','!!','😠','🤬'],
    vrm: 'angry',
    emoji: '😠',
    label: 'Frustrated',
    color: '#ef4444'
  },
  surprised: {
    keywords: ['wow','whoa','really?','seriously?','no way','what?!','omg','shocking','unexpected','!!','😮','😲'],
    vrm: 'surprised',
    emoji: '😮',
    label: 'Surprised',
    color: '#f59e0b'
  },
  confused: {
    keywords: ["don't understand","confused","what?","huh?","unclear","not sure","i don't get","explain","what do you mean","??",'🤔'],
    vrm: 'neutral',
    emoji: '🤔',
    label: 'Curious',
    color: '#a78bfa'
  },
  focused: {
    keywords: ['study','learn','practice','work','build','create','code','develop','research','focus','task','goal','plan','teach me','help me','how do i','how to'],
    vrm: 'neutral',
    emoji: '🎯',
    label: 'Focused',
    color: '#22d3ee'
  },
  neutral: {
    keywords: [],
    vrm: 'neutral',
    emoji: '😐',
    label: 'Neutral',
    color: '#64748b'
  }
};

/**
 * Detect emotion from a message string.
 * Returns: { emotion, vrm, emoji, label, color, confidence }
 */
export function detectEmotion(text) {
  if (!text || typeof text !== 'string') return EMOTION_MAP.neutral;

  const lower = text.toLowerCase();
  let bestEmotion = 'neutral';
  let bestScore   = 0;

  for (const [emotion, data] of Object.entries(EMOTION_MAP)) {
    if (emotion === 'neutral') continue;
    let score = 0;
    for (const kw of data.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore   = score;
      bestEmotion = emotion;
    }
  }

  return {
    ...EMOTION_MAP[bestEmotion],
    emotion: bestEmotion,
    confidence: Math.min(bestScore / 3, 1)  // 0–1
  };
}

/**
 * Map detected emotion to VRM preset name.
 * Three-VRM built-in presets: 'happy','sad','angry','surprised','relaxed','neutral'
 */
export function emotionToVRM(emotion) {
  const presetMap = {
    happy:     'happy',
    sad:       'sad',
    angry:     'angry',
    surprised: 'surprised',
    confused:  'relaxed',   // calm thinking face
    focused:   'neutral',
    neutral:   'neutral'
  };
  return presetMap[emotion] ?? 'neutral';
}
