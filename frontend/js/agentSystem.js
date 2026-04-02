/**
 * plannerAgent.js + executorAgent.js
 */

/* 
   PLANNER AGENT */

const TASK_TYPES = {
  QUIZ:      'quiz',
  STUDY_PLAN:'study_plan',
  SUMMARY:   'summary',
  REMIND:    'remind',
  CHAT:      'chat',     // Default: just conversation
};

const TASK_PATTERNS = [
  { type: TASK_TYPES.QUIZ,       patterns: ['quiz me','test me','give me questions','ask me','practice questions','mcq','multiple choice'] },
  { type: TASK_TYPES.STUDY_PLAN, patterns: ['study plan','learning plan','roadmap','schedule','how to learn','where to start','learning path'] },
  { type: TASK_TYPES.SUMMARY,    patterns: ['summarize','summary','tldr','short version','brief explanation','in brief','explain briefly'] },
  { type: TASK_TYPES.REMIND,     patterns: ['remind me','remember this','save this','don\'t forget','note that','keep in mind'] },
];

/**
 * Classify the user's message into a task type.
 * Returns: { type, confidence, originalMsg }
 */
export function planTask(userMsg) {
  const lower = userMsg.toLowerCase();

  for (const { type, patterns } of TASK_PATTERNS) {
    for (const p of patterns) {
      if (lower.includes(p)) {
        return { type, confidence: 0.85, originalMsg: userMsg };
      }
    }
  }

  return { type: TASK_TYPES.CHAT, confidence: 1.0, originalMsg: userMsg };
}

/* 
   EXECUTOR AGENT
   can handles special tasks before  */

import { saveMemory, getMemory } from './memoryService.js';


export function executeTask(plan, profile) {
  const { type, originalMsg } = plan;

  switch (type) {

    case TASK_TYPES.QUIZ:
      return {
        handled: true,
        systemHint: `The user wants to be quizzed. Generate exactly 3 multiple-choice questions 
          about the topic they mentioned (or their current study topic: ${profile.topic || 'general knowledge'}). 
          Format each as:
          Q1. [question]
          A) ... B) ... C) ... D) ...
          Answer: [letter]
          Keep it concise and educational.`,
        uiAction: 'show_quiz'
      };

    case TASK_TYPES.STUDY_PLAN:
      return {
        handled: true,
        systemHint: `The user wants a structured study plan. 
          Create a 4-week learning roadmap for: "${originalMsg}". 
          Format as Week 1, Week 2, etc. with 3-4 bullet points each. 
          Be specific, practical, and beginner-friendly if their level is beginner.`,
        uiAction: 'show_plan'
      };

    case TASK_TYPES.SUMMARY:
      return {
        handled: true,
        systemHint: `Give an extremely concise summary (max 5 sentences or bullet points). 
          Lead with the most important concept. Use simple language.`,
        uiAction: null
      };

    case TASK_TYPES.REMIND:
      // Extract what they want to remember
      const remindMatch = originalMsg.match(/(?:remind me|remember|save|note)[:\s]+(.+)/i);
      if (remindMatch) {
        const fact = remindMatch[1].trim();
        saveMemory(`note_${Date.now()}`, fact);
      }
      return {
        handled: true,
        systemHint: `The user asked you to remember something. Confirm that you've saved it to memory and briefly acknowledge it.`,
        uiAction: 'memory_saved'
      };

    case TASK_TYPES.CHAT:
    default:
      return {
        handled: false,
        systemHint: '',
        uiAction: null
      };
  }
}
