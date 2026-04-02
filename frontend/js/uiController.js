/**
 * uiController.js
 
 */

import { getAllMemories, clearAllMemories } from './memoryService.js';


export function addMessage(role, text, meta = '') {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `msg msg-${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  // Simple markdown: bold **text**, line breaks
  bubble.innerHTML = formatText(text);

  div.appendChild(bubble);

  if (meta) {
    const metaEl = document.createElement('div');
    metaEl.className = 'msg-meta';
    metaEl.textContent = meta;
    div.appendChild(metaEl);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

export function addTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return null;

  const div = document.createElement('div');
  div.className = 'msg msg-aria msg-typing';
  div.id = 'typing-indicator';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';

  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

export function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

export function clearChat() {
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
}

function formatText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/```([\s\S]*?)```/g, '<code style="display:block;background:var(--surface);padding:8px;border-radius:6px;font-size:11px;margin-top:6px;white-space:pre-wrap;overflow-x:auto">$1</code>');
}

/* Status HUD  */

export function setStatus(state, label) {
  const dot   = document.getElementById('status-dot');
  const lbl   = document.getElementById('status-label');
  if (!dot || !lbl) return;

  dot.className = `status-dot ${state}`;
  lbl.textContent = label;
}

export function setLoaderStatus(msg) {
  const el = document.getElementById('loader-status');
  if (el) el.textContent = msg;
}

export function hideLoader() {
  const el = document.getElementById('loading-screen');
  if (el) el.classList.add('hidden');
}


export function showEmotionBadge(emotionData) {
  const badge = document.getElementById('emotion-badge');
  if (!badge) return;
  badge.textContent = `${emotionData.emoji} ${emotionData.label}`;
  badge.style.borderColor = `${emotionData.color}44`;
  badge.style.color = emotionData.color;
  badge.classList.add('visible');

  clearTimeout(badge._timer);
  badge._timer = setTimeout(() => badge.classList.remove('visible'), 4000);
}


let toastTimer = null;
export function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}


export function renderMemoryPanel() {
  const list = document.getElementById('memory-list');
  if (!list) return;

  const memories = getAllMemories();
  const entries  = Object.values(memories).sort((a, b) => b.timestamp - a.timestamp);

  if (!entries.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px">No memories stored yet.</p>';
    return;
  }

  list.innerHTML = entries.map(m => `
    <div class="memory-item">
      <span class="memory-key">${m.key.replace(/_/g, ' ')}</span>
      <span class="memory-val">${m.value}</span>
      <span class="memory-time">${formatTime(m.timestamp)}</span>
    </div>
  `).join('');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


export function setupNavigation(onPanelChange) {
  const navBtns    = document.querySelectorAll('.nav-btn');
  const chatPanel  = document.getElementById('chat-panel');
  const memPanel   = document.getElementById('memory-panel');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panel = btn.dataset.panel;

      chatPanel.classList.toggle('hidden', panel !== 'chat');
      memPanel.classList.toggle('panel-hidden', panel !== 'memory');

      if (panel === 'memory') renderMemoryPanel();
      if (onPanelChange) onPanelChange(panel);
    });
  });

  // Close memory panel
  document.getElementById('btn-close-memory')?.addEventListener('click', () => {
    document.getElementById('memory-panel')?.classList.add('panel-hidden');
    document.getElementById('chat-panel')?.classList.remove('hidden');
    navBtns.forEach((b, i) => b.classList.toggle('active', i === 0));
  });

  // Clear memory
  document.getElementById('btn-clear-memory')?.addEventListener('click', () => {
    if (confirm('Clear all ARIA memories?')) {
      clearAllMemories();
      renderMemoryPanel();
      showToast('Memory cleared');
    }
  });
}
