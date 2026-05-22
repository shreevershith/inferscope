// Fetches live model leaderboards from the arena-ai-leaderboards proxy
// (https://api.wulong.dev), which mirrors arena.ai's text/code/vision boards.
//
// API requires a `name` slug. We pull the `text` board by default (general
// LLM chat ranking) and optionally merge `code` + `vision` for broader
// coverage, taking the max ELO per model across boards.

import { ApiClientError } from './ApiClientError'

const ARENA_BASE = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard'
const FETCH_TIMEOUT_MS = 10_000
// Boards relevant to text-generation LLMs. Image/video boards excluded —
// they evaluate generative-media models that don't appear in OpenRouter's
// chat catalog. Document + search broaden ELO coverage for RAG/agent models.
const BOARDS = ['text', 'code', 'vision', 'document', 'search']

async function fetchBoard(name, signal) {
  const res = await fetch(`${ARENA_BASE}?name=${encodeURIComponent(name)}`, { signal })
  if (!res.ok) {
    throw new ApiClientError(`Arena ${name} board error: ${res.status}`, { status: res.status, source: 'arena' })
  }
  const data = await res.json().catch(() => null)
  if (!data || !Array.isArray(data.models)) {
    throw new ApiClientError(`Arena ${name} board returned unexpected payload`, { source: 'arena' })
  }
  return data.models.map(m => ({ ...m, _board: name }))
}

// Compute mean + stddev of a numeric array. Returns null stddev when N<2.
function stats(values) {
  if (values.length === 0) return { mean: 0, stddev: null }
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (values.length < 2) return { mean, stddev: null }
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return { mean, stddev: Math.sqrt(variance) || null }
}

export async function fetchArenaLeaderboard() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // Fetch all boards in parallel; partial-failures don't kill the merge.
    const results = await Promise.allSettled(
      BOARDS.map(name => fetchBoard(name, controller.signal))
    )

    // Each board has a different ELO distribution — code-board #1 may have
    // raw ELO 1450 while text-board #1 has 1500, but both represent the
    // SAME relative strength. Normalize each board to a z-score first so
    // "best across boards" is fair. Then convert the winning z-score back
    // to a synthetic ELO using the *text* board's mean+stddev so the values
    // remain interpretable to users familiar with chatbot-arena scores.
    const fulfilled = results.filter(r => r.status === 'fulfilled').map(r => r.value)
    if (fulfilled.length === 0) {
      const error = new Error('All Arena boards failed')
      error.source = 'arena'
      throw error
    }

    // Compute per-board stats
    const boardStats = new Map()
    for (const board of fulfilled) {
      const scores = board.map(e => Number(e.score) || 0).filter(s => s > 0)
      const boardName = board[0]?._board || 'unknown'
      boardStats.set(boardName, stats(scores))
    }

    // Reference distribution = text board (the canonical "chat" leaderboard).
    // Fall back to the first available board if text wasn't fetched.
    const ref = boardStats.get('text') || boardStats.values().next().value

    // Walk every entry, compute its z-score in its source board, keep the
    // entry with the highest z per model name. Then map that z back through
    // the reference distribution so downstream code still sees ELO numbers.
    const byName = new Map()
    for (const board of fulfilled) {
      const boardName = board[0]?._board || 'unknown'
      const { mean, stddev } = boardStats.get(boardName) || {}
      for (const entry of board) {
        const key = String(entry.model || entry.name || '').toLowerCase()
        if (!key) continue
        const rawScore = Number(entry.score) || 0
        // z = (score - mean) / stddev. If stddev is null (single entry on a
        // board), fall back to raw score for ranking — better than dropping.
        const z = stddev ? (rawScore - mean) / stddev : 0
        const existing = byName.get(key)
        // Synthetic ELO: ref.mean + z * ref.stddev. Preserves "1500 = great"
        // intuition even when the source board had a tighter spread.
        const refStddev = ref?.stddev || stddev || 50
        const refMean = ref?.mean || mean || 1300
        const adjustedScore = stddev ? Math.round(refMean + z * refStddev) : rawScore
        if (!existing) {
          byName.set(key, { ...entry, score: adjustedScore, _z: z, _rawScore: rawScore, _boards: [boardName] })
        } else {
          // Accumulate every board a model appeared on for task-strength inference
          if (!existing._boards.includes(boardName)) {
            existing._boards.push(boardName)
          }
          if (z > existing._z) {
            const boards = existing._boards
            byName.set(key, { ...entry, score: adjustedScore, _z: z, _rawScore: rawScore, _boards: boards })
          }
        }
      }
    }

    const merged = Array.from(byName.values())
    if (merged.length === 0) {
      const error = new Error('All Arena boards empty after merge')
      error.source = 'arena'
      throw error
    }
    return merged
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

// Throttle malformed-entry warnings. If Arena ships a schema change that
// breaks 50 rows, we'd flood the console with identical noise. Log the first
// few + a summary, then go silent for the rest of the session.
let normalizationWarnCount = 0
const MAX_NORMALIZATION_WARNS = 3

export function normalizeArenaModel(entry) {
  try {
    return {
      // Use ?? so an explicit empty string still wins over the next fallback
      name: safeStr(entry.model ?? entry.name ?? '', 100),
      arenaElo: safeNum(entry.score ?? entry.elo ?? entry.rating),
      voteCount: safeNum(entry.votes ?? entry.num_battles),
      rank: safeNum(entry.rank),
      provider: safeStr(entry.vendor ?? entry.organization ?? '', 50),
      license: safeStr(entry.license ?? '', 30),
      board: safeStr(entry._board ?? '', 20),
      boards: Array.isArray(entry._boards) ? entry._boards : (entry._board ? [entry._board] : []),
      source: 'arena',
    }
  } catch (err) {
    normalizationWarnCount += 1
    if (normalizationWarnCount <= MAX_NORMALIZATION_WARNS) {
      console.warn(`[arenaClient] Failed to normalize Arena entry (${normalizationWarnCount}):`, err.message)
      if (normalizationWarnCount === MAX_NORMALIZATION_WARNS) {
        console.warn(`[arenaClient] Suppressing further normalization warnings this session.`)
      }
    }
    return null
  }
}
