/**
 * emotionReactor.js  

/*  Config injected at init */
let _triggerExpression = null;
let _playAnimSequence  = null;
let _showToast         = null;
let _vrmLoaded         = () => false;

/*  Emotion → Animation mapping  */
// Maps emotion type to: { expression, duration, anims, toast }
const REACTION_MAP = {
  happy: {
    expression: 'happy',
    duration:   3000,
    anims:      ['clapping'],          // Play clapping for happiness
    toast:      null
  },
  sad: {
    expression: 'sad',
    duration:   4000,
    anims:      [],
    toast:      null
  },
  angry: {
    expression: 'angry',
    duration:   3000,
    anims:      [],
    toast:      null
  },
  surprised: {
    expression: 'surprised',
    duration:   2500,
    anims:      ['jump'],              // Jump for surprise
    toast:      null
  },
  confused: {
    expression: 'relaxed',
    duration:   3000,
    anims:      [],
    toast:      null
  },
  focused: {
    expression: 'neutral',
    duration:   2000,
    anims:      [],
    toast:      null
  },
  neutral: {
    expression: 'neutral',
    duration:   1000,
    anims:      [],
    toast:      null
  }
};

/*  Throttle  */
// Prevent expression spam on every keypress — minimum 2s between reactions
let _lastReactionTime = 0;
const MIN_REACTION_INTERVAL = 2000;

/**
 * Initialize the emotion reactor with function references from main.js.
 * Call this ONCE during app startup.
 *
 * @param {object} config
 * @param {Function} config.triggerExpressionFn   - sceneAR.triggerExpression
 * @param {Function} config.playAnimSequenceFn    - sceneAR.playAnimSequence
 * @param {Function} config.showToastFn           - uiController.showToast
 * @param {Function} config.vrmLoadedFn           - () => boolean — is VRM loaded?
 */
export function initEmotionReactor({ triggerExpressionFn, playAnimSequenceFn, showToastFn, vrmLoadedFn }) {
  _triggerExpression = triggerExpressionFn;
  _playAnimSequence  = playAnimSequenceFn;
  _showToast         = showToastFn;
  _vrmLoaded         = vrmLoadedFn || (() => false);
  console.log('[EmotionReactor] Initialized');
}

/**
 * React to a detected emotion.

 * @param {object} emotionObj   - Output from detectEmotion()
 *   { emotion, vrm, emoji, label, color, confidence }
 */
export function reactToEmotion(emotionObj) {
  if (!emotionObj || !_triggerExpression) return;

  const now = Date.now();
  if (now - _lastReactionTime < MIN_REACTION_INTERVAL) return;
  _lastReactionTime = now;

  const { emotion, confidence = 0 } = emotionObj;
  const reaction = REACTION_MAP[emotion] || REACTION_MAP.neutral;

  
  if (confidence < 0.15 && emotion !== 'neutral') return;

  if (_vrmLoaded()) {
    _triggerExpression(reaction.expression, reaction.duration);

    if (reaction.anims.length > 0 && confidence > 0.3) {
      setTimeout(() => {
        if (_playAnimSequence) {
          _playAnimSequence(reaction.anims);
        }
      }, 500);
    }
  }

  if (reaction.toast && _showToast) {
    _showToast(reaction.toast);
  }
}

/**
 * @param {string} emotion   - Emotion key (e.g. 'happy')
 * @param {object} config    - Partial config to merge
 */
export function configureReaction(emotion, config) {
  if (REACTION_MAP[emotion]) {
    Object.assign(REACTION_MAP[emotion], config);
  }
}

/**
 * Get current reaction map (for debug / settings UI).
 * @returns {object}
 */
export function getReactionMap() {
  return { ...REACTION_MAP };
}
