// Lightweight fuzzy match over the model list. Three-tier ranking:
//
//   1. Exact / substring match in name (highest)
//   2. Substring match in provider OR description (mid)
//   3. Typo-tolerant match within ~2 Levenshtein-edit distance (lowest)
//
// Returns models sorted by score; equal scores preserve original order.

// Iterative Damerau-style Levenshtein (with transpositions). Operates on
// short strings only — capped at maxLen for speed.
function levenshtein(a, b, max = 2) {
  if (a === b) return 0
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  if (la === 0) return lb
  if (lb === 0) return la
  // Two-row DP, exit early if min on row > max
  let prev = new Array(lb + 1)
  let curr = new Array(lb + 1)
  for (let j = 0; j <= lb; j++) prev[j] = j
  for (let i = 1; i <= la; i++) {
    curr[0] = i
    let rowMin = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,         // insert
        prev[j] + 1,             // delete
        prev[j - 1] + cost,      // substitute
      )
      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prev[j - 2] !== undefined ? prev[j - 2] + cost : Infinity)
      }
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > max) return max + 1
    ;[prev, curr] = [curr, prev]
  }
  return prev[lb]
}

// Score a single model against a query token. Higher = better.
function scoreToken(model, token) {
  if (!token) return 0
  const t = token.toLowerCase()
  const name = (model.name || '').toLowerCase()
  const provider = (model.provider || '').toLowerCase()
  const desc = (model.description || '').toLowerCase()

  // Tier 1 — exact name hit
  if (name === t) return 1000
  if (name.startsWith(t)) return 800
  if (name.includes(t)) return 600

  // Tier 2 — provider / description substring
  if (provider.includes(t)) return 400
  if (desc.includes(t)) return 300

  // Tier 3 — typo tolerance against any word in name (≤ 2 edits)
  if (t.length >= 4) {
    const nameWords = name.split(/[\s\-_:.()/]+/).filter(Boolean)
    for (const w of nameWords) {
      if (Math.abs(w.length - t.length) > 2) continue
      const d = levenshtein(w, t, 2)
      if (d === 0) return 700  // exact word match
      if (d === 1) return 200
      if (d === 2) return 100
    }
  }

  return 0
}

/**
 * Score every model against the (possibly multi-word) query.
 * Returns the same array filtered to score>0, sorted by score desc.
 * If query is empty/whitespace, returns the original array unchanged.
 */
export function fuzzyFilter(models, query) {
  if (!Array.isArray(models)) return []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return models

  // Multi-word: each model's score = sum of token scores. A model with
  // ALL tokens matching beats one with only some.
  const tokens = q.split(/\s+/).filter(Boolean)
  const scored = []
  for (const m of models) {
    let total = 0
    let matchedTokens = 0
    for (const t of tokens) {
      const s = scoreToken(m, t)
      if (s > 0) { total += s; matchedTokens += 1 }
    }
    // Require all tokens to match at least minimally — prevents "claude code"
    // returning every Claude OR every coder.
    if (matchedTokens === tokens.length && total > 0) {
      scored.push({ model: m, score: total })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.model)
}
