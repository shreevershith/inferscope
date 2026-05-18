// Optimization-tip generators. Each takes the live model list + the user's
// current calculator state, returns either a tip object or null (not
// applicable right now). The Model Arena sidebar cycles through the
// non-null results so the suggestion changes with both the data AND the
// user's chosen configuration.
//
// Tip shape:
//   {
//     id: string,            // stable id for React keys
//     kind: string,          // category — 'cost' | 'caching' | 'context' | …
//     icon: string,          // Material Symbols glyph
//     headline: string,      // short title (≤24 chars)
//     segments: Segment[]    // rendered as inline spans by the consumer
//   }
//
// Segment shape: { text: string, style?: 'bold' | 'accent' | 'highlight' }
// Pure data — no JSX so the module can be unit-tested without React.

// ────────── helpers ──────────

function priced(model) {
  return model && !model.isVariablePrice && Number.isFinite(model.inputPricePerMToken) && model.inputPricePerMToken > 0
}

function topByElo(models) {
  return models.filter(m => priced(m) && (m.arenaElo || 0) > 0)
    .sort((a, b) => (b.arenaElo || 0) - (a.arenaElo || 0))[0]
}

function bestValuePriced(models) {
  return models.filter(m => priced(m) && m.valueScore != null)
    .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))[0]
}

// Safe percentage rounder. Treats null/undefined/NaN/Infinity as 0 so a
// missing field never leaks "NaN%" into the UI.
function pct(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

// Safe ratio — protects denominators. Returns 0 when either side is
// non-finite or the denominator is ≤ 0.
function ratio(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0
  return num / den
}

function s(text, style) {
  return { text, style }
}

// ────────── generators ──────────

// 1. Classic: quality-per-dollar winner vs ELO leader.
function tipBestValue(models) {
  const top = topByElo(models)
  const best = bestValuePriced(models)
  if (!top || !best || top.id === best.id) return null
  const savings = pct(ratio(top.inputPricePerMToken - best.inputPricePerMToken, top.inputPricePerMToken) * 100)
  if (savings <= 5) return null
  const qualityMatch = (best.qualityScore || 0) >= (top.qualityScore || 0) * 0.85
  return {
    id: 'best-value',
    kind: 'cost',
    icon: 'savings',
    headline: 'Cheaper alternative',
    segments: [
      s('Switch from '),
      s(top.name, 'bold'),
      s(' to '),
      s(best.name, 'accent'),
      s(' for '),
      s(`${savings}%`, 'highlight'),
      s(` cost savings with ${qualityMatch ? 'comparable' : 'some'} quality trade-off.`),
    ],
  }
}

// 2. Open-source alternative that reaches a reasonable fraction of top quality.
function tipOpenSource(models) {
  const top = topByElo(models.filter(m => m.license === 'proprietary'))
  if (!top) return null
  const openContenders = models.filter(m =>
    m.license === 'open' && priced(m) && (m.qualityScore || 0) >= (top.qualityScore || 0) * 0.7
  )
  if (openContenders.length === 0) return null
  const open = openContenders.sort((a, b) => a.inputPricePerMToken - b.inputPricePerMToken)[0]
  if (open.id === top.id) return null
  const savings = pct(ratio(top.inputPricePerMToken - open.inputPricePerMToken, top.inputPricePerMToken) * 100)
  if (savings <= 10) return null
  const qPct = pct(ratio(open.qualityScore || 0, top.qualityScore || 0) * 100)
  return {
    id: 'open-source',
    kind: 'open',
    icon: 'lock_open',
    headline: 'Open-source alternative',
    segments: [
      s('Open-source '),
      s(open.name, 'accent'),
      s(' hits '),
      s(`${qPct}%`, 'highlight'),
      s(' of '),
      s(top.name, 'bold'),
      s("'s quality at "),
      s(`${savings}%`, 'highlight'),
      s(' less cost.'),
    ],
  }
}

// 3. Cache-hit-rate nudge — only when calculator has a model selected.
function tipCaching(models, calc) {
  if (!calc?.selectedModelId) return null
  const hitRate = Number(calc.cachingHitRate) || 0
  if (hitRate >= 60) return null
  const selected = models.find(m => m.id === calc.selectedModelId)
  if (!selected || !priced(selected)) return null
  const inputTokens = Number(calc.inputTokens) || 0
  const requestsPerDay = Number(calc.requestsPerDay) || 0
  const monthlyInputTokens = inputTokens * requestsPerDay * 30
  const additionalCachedFraction = (60 - hitRate) / 100
  const fullPriceCost = (monthlyInputTokens * additionalCachedFraction / 1_000_000) * selected.inputPricePerMToken
  const cachedCost = fullPriceCost * 0.1
  const savings = fullPriceCost - cachedCost
  if (savings < 1) return null
  const fmtSavings = savings >= 1000 ? `$${(savings / 1000).toFixed(1)}K` : `$${savings.toFixed(0)}`
  return {
    id: 'caching',
    kind: 'caching',
    icon: 'memory',
    headline: 'Cache more aggressively',
    segments: [
      s('Raising your cache hit rate from '),
      s(`${hitRate}%`, 'bold'),
      s(' to '),
      s('60%', 'accent'),
      s(' on '),
      s(selected.name, 'bold'),
      s(' saves about '),
      s(`${fmtSavings}/mo`, 'highlight'),
      s('.'),
    ],
  }
}

// 4. Family ladder: cheaper sibling in the same family.
function tipFamilyLadder(models, calc) {
  if (!calc?.selectedModelId) return null
  const selected = models.find(m => m.id === calc.selectedModelId)
  if (!selected || !priced(selected)) return null
  const familyToken = selected.name
    .replace(/\s*\([^)]*\)\s*/g, '')
    .split(/[\s-]+/)
    .filter(w => /^[A-Za-z]+$/.test(w))[0]
  if (!familyToken || familyToken.length < 4) return null
  const siblings = models.filter(m =>
    m.id !== selected.id &&
    m.provider === selected.provider &&
    priced(m) &&
    m.inputPricePerMToken < selected.inputPricePerMToken * 0.6 &&
    m.name.toLowerCase().includes(familyToken.toLowerCase()) &&
    (m.qualityScore || 0) >= (selected.qualityScore || 0) * 0.7
  )
  if (siblings.length === 0) return null
  const cheapestSibling = siblings.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0]
  const savings = pct(ratio(selected.inputPricePerMToken - cheapestSibling.inputPricePerMToken, selected.inputPricePerMToken) * 100)
  const qPct = pct(ratio(cheapestSibling.qualityScore || 0, selected.qualityScore || 0) * 100)
  return {
    id: 'family-ladder',
    kind: 'family',
    icon: 'stairs',
    headline: 'Smaller sibling',
    segments: [
      s(cheapestSibling.name, 'accent'),
      s(' costs '),
      s(`${savings}%`, 'highlight'),
      s(' less than '),
      s(selected.name, 'bold'),
      s(' and keeps roughly '),
      s(`${qPct}%`, 'highlight'),
      s(' of the quality.'),
    ],
  }
}

// 5. Context-window arbitrage: massive context but tiny prompts.
function tipContextOverkill(models, calc) {
  if (!calc?.selectedModelId) return null
  const selected = models.find(m => m.id === calc.selectedModelId)
  if (!selected || !priced(selected)) return null
  const usedTokens = (Number(calc.inputTokens) || 0) + (Number(calc.outputTokens) || 0)
  if (!selected.contextWindow || selected.contextWindow < 200_000) return null
  if (usedTokens > selected.contextWindow * 0.05) return null
  const targetCtx = Math.max(8000, usedTokens * 4)
  const candidates = models.filter(m =>
    m.id !== selected.id &&
    priced(m) &&
    m.contextWindow >= targetCtx &&
    m.contextWindow < selected.contextWindow * 0.5 &&
    m.inputPricePerMToken < selected.inputPricePerMToken * 0.7 &&
    (m.qualityScore || 0) >= (selected.qualityScore || 0) * 0.8
  )
  if (candidates.length === 0) return null
  const pick = candidates.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0]
  const savings = pct(ratio(selected.inputPricePerMToken - pick.inputPricePerMToken, selected.inputPricePerMToken) * 100)
  return {
    id: 'context-overkill',
    kind: 'context',
    icon: 'unfold_less',
    headline: 'Context overkill',
    segments: [
      s("You're using "),
      s(`${usedTokens.toLocaleString()}`, 'bold'),
      s(' tokens of '),
      s(selected.name, 'bold'),
      s("'s "),
      s(`${(selected.contextWindow / 1000).toFixed(0)}K`, 'bold'),
      s(' window. '),
      s(pick.name, 'accent'),
      s(' handles your workload for '),
      s(`${savings}%`, 'highlight'),
      s(' less.'),
    ],
  }
}

// 6. Output-heavy workload: output price matters more when output >> input.
function tipOutputHeavy(models, calc) {
  if (!calc?.selectedModelId) return null
  const inTok = Number(calc.inputTokens) || 0
  const outTok = Number(calc.outputTokens) || 0
  if (outTok < inTok * 1.5 || outTok < 100) return null
  const selected = models.find(m => m.id === calc.selectedModelId)
  if (!selected || !priced(selected) || !Number.isFinite(selected.outputPricePerMToken) || selected.outputPricePerMToken <= 0) return null
  const candidates = models.filter(m =>
    m.id !== selected.id &&
    priced(m) &&
    Number.isFinite(m.outputPricePerMToken) &&
    m.outputPricePerMToken > 0 &&
    m.outputPricePerMToken < selected.outputPricePerMToken * 0.6 &&
    (m.qualityScore || 0) >= (selected.qualityScore || 0) * 0.85
  )
  if (candidates.length === 0) return null
  const pick = candidates.sort((a, b) => a.outputPricePerMToken - b.outputPricePerMToken)[0]
  const savings = pct(ratio(selected.outputPricePerMToken - pick.outputPricePerMToken, selected.outputPricePerMToken) * 100)
  return {
    id: 'output-heavy',
    kind: 'output',
    icon: 'output',
    headline: 'Output-heavy workload',
    segments: [
      s('Your prompts generate '),
      s(`${outTok}`, 'bold'),
      s(' output tokens per '),
      s(`${inTok}`, 'bold'),
      s(' input. '),
      s(pick.name, 'accent'),
      s("'s output price is "),
      s(`${savings}%`, 'highlight'),
      s(' lower than '),
      s(selected.name, 'bold'),
      s("'s."),
    ],
  }
}

// 7. Underrated gem: high-quality model from a non-mainstream provider.
function tipUnderrated(models) {
  const MAINSTREAM = new Set(['OpenAI', 'Anthropic', 'Google', 'Meta', 'Microsoft'])
  const candidates = models.filter(m =>
    !MAINSTREAM.has(m.provider) &&
    priced(m) &&
    (m.arenaElo || 0) >= 1400 &&
    m.inputPricePerMToken <= 3
  )
  if (candidates.length === 0) return null
  const pick = candidates.sort((a, b) => (b.arenaElo || 0) - (a.arenaElo || 0))[0]
  return {
    id: 'underrated',
    kind: 'discover',
    icon: 'travel_explore',
    headline: 'Underrated pick',
    segments: [
      s(pick.name, 'accent'),
      s(' from '),
      s(pick.provider, 'bold'),
      s(' ranks at ELO '),
      s(`${pick.arenaElo}`, 'highlight'),
      s(' for just '),
      s(`$${pick.inputPricePerMToken.toFixed(2)}/M`, 'highlight'),
      s(' — often overlooked.'),
    ],
  }
}

// ────────── public ──────────

const GENERATORS = [
  tipBestValue,
  tipOpenSource,
  tipCaching,
  tipFamilyLadder,
  tipContextOverkill,
  tipOutputHeavy,
  tipUnderrated,
]

export function buildOptimizationTips({ models, calculatorInputs } = {}) {
  if (!Array.isArray(models) || models.length === 0) return []
  const calc = calculatorInputs || {}
  return GENERATORS
    .map(g => {
      try {
        return g(models, calc)
      } catch (err) {
        // Don't break the rotation when a single generator throws — log so
        // the bug can be fixed, but keep the other tips rendering.
        // eslint-disable-next-line no-console
        console.warn(`[optimizationTips] ${g.name} threw:`, err)
        return null
      }
    })
    .filter(Boolean)
}
