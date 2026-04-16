const ARENA_API = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard'
const FETCH_TIMEOUT_MS = 10_000

export async function fetchArenaLeaderboard() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(ARENA_API, { signal: controller.signal })
    if (!res.ok) {
      const error = new Error(`Arena API error: ${res.status}`)
      error.status = res.status
      error.source = 'arena'
      throw error
    }
    const data = await res.json().catch(() => null)
    if (data == null) {
      const error = new Error('Arena API returned invalid JSON')
      error.source = 'arena'
      throw error
    }
    if (Array.isArray(data)) return data
    if (Array.isArray(data.leaderboard)) return data.leaderboard
    if (Array.isArray(data.data)) return data.data
    return []
  } catch (err) {
    if (!err.source) err.source = 'arena'
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function safeStr(value, maxLen = 200) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen)
}

function safeNum(value) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function normalizeArenaModel(entry) {
  try {
    return {
      // Use ?? so an explicit empty string still wins over the next fallback
      name: safeStr(entry.model ?? entry.name ?? '', 100),
      arenaElo: safeNum(entry.elo ?? entry.score ?? entry.rating),
      voteCount: safeNum(entry.votes ?? entry.num_battles),
      rank: safeNum(entry.rank),
      provider: safeStr(entry.organization ?? entry.vendor ?? '', 50),
      license: safeStr(entry.license ?? '', 30),
      source: 'arena',
    }
  } catch (err) {
    console.warn('Failed to normalize Arena entry:', err.message)
    return null
  }
}
