// Dynamic "Suggested Questions" generators for the AI Advisor panel.
// Each generator inspects the user's state (selected model, calculator
// inputs, top-ranked model) and returns either a string question or null.
// The panel takes the first ~5 non-null suggestions.
//
// Goal: prove to the user that the Advisor really does see their state —
// suggestions should reference their actual numbers, not generic templates.

function priced(m) {
  return m && !m.isVariablePrice && Number.isFinite(m.inputPricePerMToken) && m.inputPricePerMToken > 0
}

// 1. Selected model + their current monthly cost → "Can I cut the bill?"
function qReduceCost({ selected, monthlyCost }) {
  if (!selected || !monthlyCost) return null
  return `How can I cut ${selected.name}'s ${monthlyCost} bill in half?`
}

// 2. Compare selected model vs top-ranked model
function qCompareWithTop({ selected, topRanked }) {
  if (!selected || !topRanked || selected.id === topRanked.id) return null
  return `Should I switch from ${selected.name} to ${topRanked.name}?`
}

// 3. Open-source alternative to selected proprietary model
function qOpenAlternative({ selected }) {
  if (!selected || selected.license !== 'proprietary') return null
  return `What's the best open-source alternative to ${selected.name}?`
}

// 4. Caching question — only if cache hit rate is low
function qCaching({ calc }) {
  if (!calc?.selectedModelId) return null
  if ((calc.cachingHitRate || 0) >= 60) return null
  return `What kinds of prompts should I cache to raise my hit rate above 60%?`
}

// 5. Volume-based question
function qVolumeScaling({ calc, selected, monthlyCost }) {
  if (!calc?.selectedModelId || !selected) return null
  const reqPerDay = Number(calc.requestsPerDay) || 0
  if (reqPerDay < 100) return null
  const next = reqPerDay < 1000 ? '10K req/day' : reqPerDay < 10000 ? '100K req/day' : '1M req/day'
  return `What would my ${monthlyCost || 'cost'} look like at ${next}?`
}

// 6. Task-specific recommendation based on focus filter (if anything beyond default)
function qTaskFit({ calc, selected }) {
  if (!selected) return null
  // Heuristic: which task is the user most likely targeting based on selected model's strengths?
  const strengths = selected.taskStrengths || []
  if (strengths.includes('code')) return `Is ${selected.name} actually the best for coding workloads, or is there something cheaper?`
  if (strengths.includes('reasoning')) return `For multi-step reasoning, is ${selected.name} overkill at this price?`
  return null
}

// 7. Context-window question — when selected model has a massive window
function qContextSize({ selected, calc }) {
  if (!selected) return null
  if (!selected.contextWindow || selected.contextWindow < 200_000) return null
  const used = (Number(calc?.inputTokens) || 0) + (Number(calc?.outputTokens) || 0)
  if (used >= selected.contextWindow * 0.1) return null  // they're using it
  return `I'm only using ${used} of ${selected.contextWindow.toLocaleString()} tokens — do I need this much context?`
}

// 8. Generic fallback (always useful)
function qBudget() {
  return `What's the best model for under $500/month?`
}

function qRAG() {
  return `What's the cheapest model for RAG document extraction?`
}

function qCachingFundamentals() {
  return `When is prompt caching worth setting up?`
}

const GENERATORS = [
  qReduceCost,
  qCompareWithTop,
  qOpenAlternative,
  qCaching,
  qVolumeScaling,
  qTaskFit,
  qContextSize,
]

const FALLBACKS = [
  qBudget,
  qRAG,
  qCachingFundamentals,
]

/**
 * Build a personalized list of suggested questions for the AI Advisor.
 * Always returns at least 3 questions — falls through to evergreens when
 * the user has no selected model / no Arena data.
 */
export function buildSuggestedQuestions({ models, calculatorInputs }) {
  const list = Array.isArray(models) ? models : []
  const calc = calculatorInputs || {}
  const selected = calc.selectedModelId
    ? list.find(m => m.id === calc.selectedModelId)
    : null
  const topRanked = list.filter(m => priced(m) && (m.arenaElo || 0) > 0)
    .sort((a, b) => (b.arenaElo || 0) - (a.arenaElo || 0))[0] || null

  // Compute monthly cost label for question templates that want it
  let monthlyCost = null
  if (selected && priced(selected)) {
    const reqMo = (Number(calc.requestsPerDay) || 0) * 30
    const inMo = reqMo * (Number(calc.inputTokens) || 0)
    const outMo = reqMo * (Number(calc.outputTokens) || 0)
    const cacheRate = (Number(calc.cachingHitRate) || 0) / 100
    const inputCost = (inMo / 1_000_000) * (
      selected.inputPricePerMToken * (1 - cacheRate) +
      (selected.cachedInputPrice || selected.inputPricePerMToken * 0.1) * cacheRate
    )
    const outputCost = (outMo / 1_000_000) * (selected.outputPricePerMToken || 0)
    const m = inputCost + outputCost
    if (m > 0) {
      monthlyCost = m >= 1000 ? `$${(m / 1000).toFixed(1)}K/mo` : `$${m.toFixed(0)}/mo`
    }
  }

  const ctx = { selected, topRanked, calc, monthlyCost }
  const personalized = GENERATORS
    .map(g => { try { return g(ctx) } catch { return null } })
    .filter(Boolean)

  // Top up to 5 questions with evergreens, no duplicates
  const out = [...personalized]
  for (const fb of FALLBACKS) {
    if (out.length >= 5) break
    const q = fb()
    if (q && !out.includes(q)) out.push(q)
  }
  return out.slice(0, 5)
}
