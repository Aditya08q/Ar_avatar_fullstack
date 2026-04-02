/**
 * plannerAgent.js 

 */

/*  Task type registry */

export const TASK = {
  QUIZ:           'quiz',
  STUDY_PLAN:     'study_plan',
  SUMMARY:        'summary',
  REMIND:         'remind',
  CODE:           'code',
  MATH:           'math',
  TRANSLATE:      'translate',
  KNOWLEDGE_ADD:  'knowledge_add',   
  KNOWLEDGE_ASK:  'knowledge_ask',   
  CHAT:           'chat',            
};

/*  Pattern matching rules */

const RULES = [
  {
    type:     TASK.QUIZ,
    patterns: ['quiz me', 'test me', 'give me questions', 'ask me', 'practice questions',
               'mcq', 'multiple choice', 'flashcard', 'drill me'],
  },
  {
    type:     TASK.STUDY_PLAN,
    patterns: ['study plan', 'learning plan', 'roadmap', 'schedule', 'how to learn',
               'where to start', 'learning path', 'curriculum', 'syllabus'],
  },
  {
    type:     TASK.SUMMARY,
    patterns: ['summarize', 'summary', 'tldr', 'short version', 'brief explanation',
               'in brief', 'explain briefly', 'give me the gist', 'quick overview'],
  },
  {
    type:     TASK.REMIND,
    patterns: ["remind me", "remember this", "save this", "don't forget",
               "note that", "keep in mind", "make a note", "log this"],
  },
  {
    type:     TASK.CODE,
    patterns: ['write code', 'write a function', 'code for', 'write a script',
               'fix this code', 'debug', 'implement', 'write a program',
               'how do i code', 'javascript', 'python code', 'html code'],
  },
  {
    type:     TASK.MATH,
    patterns: ['calculate', 'solve', 'what is', 'how much is', 'math problem',
               'equation', 'formula', 'compute', 'percentage of', 'square root'],
  },
  {
    type:     TASK.TRANSLATE,
    patterns: ['translate', 'in french', 'in spanish', 'in japanese', 'in hindi',
               'in german', 'how do you say', 'what does', 'mean in'],
  },
  {
    type:     TASK.KNOWLEDGE_ADD,
    patterns: ['add to knowledge', 'save to knowledge', 'remember that', 'store this',
               'add this fact', 'add this info', 'teach you that', 'learn that'],
  },
  {
    type:     TASK.KNOWLEDGE_ASK,
    patterns: ['what do you know about', 'what have i told you', 'from my notes',
               'in my knowledge base', 'check your knowledge', 'recall'],
  },
];

/**
 * Enhanced task planner.
 *
 * @param {string} userMsg
 * @returns {{ type: string, confidence: number, originalMsg: string, extras: object }}
 */
export function planTaskV2(userMsg) {
  if (!userMsg) return _defaultPlan(userMsg);

  const lower = userMsg.toLowerCase();

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (lower.includes(pattern)) {
        return {
          type:        rule.type,
          confidence:  0.85,
          originalMsg: userMsg,
          extras:      _extractExtras(rule.type, userMsg)
        };
      }
    }
  }

  if (_looksLikeFactStatement(lower)) {
    return {
      type:        TASK.REMIND,
      confidence:  0.4,
      originalMsg: userMsg,
      extras:      {}
    };
  }

  return _defaultPlan(userMsg);
}

/* Helpers */

function _defaultPlan(msg) {
  return { type: TASK.CHAT, confidence: 1.0, originalMsg: msg || '', extras: {} };
}

function _looksLikeFactStatement(lower) {
  return lower.length < 120 &&
         !lower.includes('?') &&
         (lower.includes(' is ') || lower.includes(' are ') || lower.includes(' was '));
}

function _extractExtras(type, msg) {
  const extras = {};

  if (type === TASK.REMIND || type === TASK.KNOWLEDGE_ADD) {
    const m = msg.match(/(?:remember|remind me|save|store|note|learn|teach you)[:\s]+(.+)/i);
    if (m) extras.fact = m[1].trim();
  }

  if (type === TASK.TRANSLATE) {
    const langMatch = msg.match(/\bin\s+(french|spanish|japanese|hindi|german|italian|portuguese|arabic|chinese|korean)\b/i);
    if (langMatch) extras.targetLanguage = langMatch[1];
  }

  return extras;
}
