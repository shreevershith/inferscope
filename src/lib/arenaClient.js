const ARENA_API = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard'

export async function fetchArenaLeaderboard() {
  const res = await fetch(ARENA_API)
  if (!res.ok) throw new Error(`Arena API error: ${res.status}`)
  const data = await res.json()
  // The API returns leaderboard data — extract the text/LLM category
  if (Array.isArray(data)) return data
  if (data.leaderboard) return data.leaderboard
  if (data.data) return data.data
  return []
}

export function normalizeArenaModel(entry) {
  return {
    name: entry.model || entry.name || '',
    arenaElo: entry.elo || entry.score || entry.rating || 0,
    voteCount: entry.votes || entry.num_battles || 0,
    rank: entry.rank || 0,
    provider: entry.organization || entry.vendor || '',
    license: entry.license || '',
    source: 'arena',
  }
}
