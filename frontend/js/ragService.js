/**
 * ragService.js  
 */

import { searchMemory }          from './memoryService.js';
import { searchKnowledge }       from './knowledgeBase.js';

const MAX_CONTEXT_CHARS = 800;  

/**
 * Retrieve relevant context for a user query.
 *
 * @param {string} query  
 * @returns {Promise<string>} 
 */
export async function retrieveContext(query) {
  if (!query || query.trim().length < 3) return '';

  const results = [];

  // Search localStorage memories (synchronous, fast)
  try {
    const memHits = searchMemory(query, 5);
    for (const hit of memHits) {
      if (hit.score > 0.1) {
        results.push({ source: 'memory', text: `${hit.key}: ${hit.value}`, score: hit.score });
      }
    }
  } catch (e) {
    console.warn('[RAG] Memory search error:', e);
  }

  // Search knowledge base (IndexedDB, async)
  try {
    const kbHits = await searchKnowledge(query, 5);
    for (const hit of kbHits) {
      if (hit.score > 0.05) {
        results.push({ source: 'kb', text: hit.content, score: hit.score });
      }
    }
  } catch (e) {
    console.warn('[RAG] Knowledge base search error:', e);
  }

  if (!results.length) return '';

  // Deduplicate + rank
  const ranked = results
    .sort((a, b) => b.score - a.score)
    .filter((r, i, arr) => arr.findIndex(x => x.text === r.text) === i);  // dedupe

  //  Build context string — budget-limited
  let context = '';
  for (const r of ranked) {
    const line = `• [${r.source === 'kb' ? 'Knowledge' : 'Memory'}] ${r.text}\n`;
    if ((context + line).length > MAX_CONTEXT_CHARS) break;
    context += line;
  }

  return context.trim();
}

/**
 * Quick one-line summary for debug / UI display.
 * @param {string} query
 * @returns {Promise<string>}
 */
export async function getContextSummary(query) {
  const ctx = await retrieveContext(query);
  if (!ctx) return '(no relevant context found)';
  const lines = ctx.split('\n').filter(Boolean);
  return `${lines.length} context item(s) retrieved`;
}
