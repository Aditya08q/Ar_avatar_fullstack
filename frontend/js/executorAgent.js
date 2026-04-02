/**
 * executorAgent.js  
 */

import { TASK }                        from './plannerAgent.js';
import { saveMemory }                  from './memoryService.js';
import { addKnowledge }                from './knowledgeBase.js';

/**
 * Execute a planned task.
 *
 * @param {{ type, confidence, originalMsg, extras }} plan   - From planTaskV2()
 * @param {object} profile   - User profile from getProfile()
 * @returns {Promise<{ handled: boolean, systemHint: string, uiAction: string|null }>}
 */
export async function executeTaskV2(plan, profile) {
  const { type, originalMsg, extras } = plan;

  switch (type) {

    /* Quiz  */
    case TASK.QUIZ:
      return {
        handled:    true,
        systemHint: `The user wants to be quizzed. Generate exactly 3 multiple-choice questions \
about the topic they mentioned (or their current study topic: ${profile.topic || 'general knowledge'}). \
Format each as:
Q1. [question]
A) ... B) ... C) ... D) ...
Answer: [letter]
Keep it concise and educational.`,
        uiAction: 'show_quiz'
      };

    /*  Study Plan  */
    case TASK.STUDY_PLAN:
      return {
        handled:    true,
        systemHint: `The user wants a structured study plan. \
Create a 4-week learning roadmap for: "${originalMsg}". \
Format as Week 1, Week 2, etc. with 3-4 bullet points each. \
Be specific, practical, and ${profile.level === 'beginner' ? 'beginner-friendly' : 'appropriately detailed'}.`,
        uiAction: 'show_plan'
      };

    /*  Summary  */
    case TASK.SUMMARY:
      return {
        handled:    true,
        systemHint: `Give an extremely concise summary (max 5 sentences or bullet points). \
Lead with the most important concept. Use simple language. No fluff.`,
        uiAction: null
      };

    /*  Remind / Save  */
    case TASK.REMIND: {
      if (extras.fact) {
        saveMemory(`note_${Date.now()}`, extras.fact);
      } else {
        const m = originalMsg.match(/(?:remind me|remember|save|note)[:\s]+(.+)/i);
        if (m) saveMemory(`note_${Date.now()}`, m[1].trim());
      }
      return {
        handled:    true,
        systemHint: `The user asked you to remember something. Confirm you saved it to memory, acknowledge the content briefly, and offer to help with it.`,
        uiAction:   'memory_saved'
      };
    }

    /* Code */
    case TASK.CODE:
      return {
        handled:    true,
        systemHint: `The user needs coding help. Provide clean, working code. \
Add brief inline comments for clarity. \
Use the language they specified, or JavaScript if unspecified. \
If they have bugs, explain the fix clearly. Keep explanations short — code first.`,
        uiAction: null
      };

    /*  Maths */
    case TASK.MATH:
      return {
        handled:    true,
        systemHint: `The user needs a math solution. \
Show your step-by-step working. State the final answer clearly. \
Use plain text notation (e.g. 3^2 = 9, sqrt(16) = 4). \
Keep it educational but concise.`,
        uiAction: null
      };

    /* Translate */
    case TASK.TRANSLATE: {
      const lang = extras.targetLanguage || 'the target language';
      return {
        handled:    true,
        systemHint: `The user wants a translation into ${lang}. \
Provide: (1) the translation, (2) phonetic pronunciation if relevant, (3) one brief usage note. \
Keep it short and practical.`,
        uiAction: null
      };
    }

    /* Knowledge Add */
    case TASK.KNOWLEDGE_ADD: {
      const fact = extras.fact || originalMsg;
      const title = fact.slice(0, 50);
      try {
        await addKnowledge(title, fact, 'user_added');
        console.log('[ExecutorV2] Added to knowledge base:', title);
      } catch (e) {
        console.warn('[ExecutorV2] KB add failed:', e);
      }
      return {
        handled:    true,
        systemHint: `The user asked you to save something to your knowledge base. \
Confirm you've saved it, briefly restate what you saved, and offer to use it later.`,
        uiAction: 'knowledge_saved'
      };
    }

    /* Knowledge Ask */
    case TASK.KNOWLEDGE_ASK:
      return {
        handled:    true,
        systemHint: `The user is asking about something you may have in your knowledge base. \
The relevant context has been injected above. Use it to answer directly and specifically. \
If context is empty, say you don't have information on that topic yet and offer to add it.`,
        uiAction: null
      };

    /* Default Chat */
    case TASK.CHAT:
    default:
      return { handled: false, systemHint: '', uiAction: null };
  }
}
