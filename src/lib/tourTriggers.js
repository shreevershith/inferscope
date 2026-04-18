// Per-chapter localStorage flags for the contextual workflow tour.
// Each chapter fires once (auto) when the user first enters its section.
// Re-triggering from the header menu bypasses flags entirely.

const FLAGS = {
  A: 'inferscope-tour-A-seen',
  B: 'inferscope-tour-B-seen',
  C: 'inferscope-tour-C-seen',
  D: 'inferscope-tour-D-seen',
}

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore (private mode, quota, etc.) */ }
}

export function hasSeen(chapter) {
  const key = FLAGS[chapter]
  return key ? !!safeGet(key) : true
}

export function markSeen(chapter) {
  const key = FLAGS[chapter]
  if (key) safeSet(key, '1')
}

export function clearAllFlags() {
  for (const key of Object.values(FLAGS)) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
}

// Decide whether the current state should trigger a chapter.
// Called from App.jsx on mount, tab change, or panel open.
// Returns the chapter id to start, or null.
export function pickChapterToAutoStart({ activeTab, isPanelOpen, tourChapter }) {
  // Never interrupt an in-flight chapter
  if (tourChapter) return null

  // Priority D: panel just opened and D unseen
  if (isPanelOpen && !hasSeen('D')) return 'D'

  // Priority A: first load (user lands on Arena tab = 0) and A unseen
  if (activeTab === 0 && !hasSeen('A')) return 'A'

  // Priority B: Calculator tab and B unseen
  if (activeTab === 1 && !hasSeen('B')) return 'B'

  // Priority C: Infra tab and C unseen
  if (activeTab === 2 && !hasSeen('C')) return 'C'

  return null
}
