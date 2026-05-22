// Workload-aware model recommender.
//
// Given a workload profile (req/day, in/out tokens, cache rate, optional
// monthly budget + quality floor), score every live model and return the
// best handful — ranked by a Pareto-aware score that balances quality and
// projected cost. Each returned candidate carries a one-line `reason`
// explaining why it ranks where it does.
//
// This is the "what should I actually use?" surface — Cost Calculator's
// inputs map directly to its input shape.

function priced(m) {
  return m && !m.isVariablePrice && Number.isFinite(m.inputPricePerMToken)
}

function projectMonthlyCost(model, workload) {
  const reqMo = (workload.requestsPerDay || 0) * 30
  const inMo = reqMo * (workload.inputTokens || 0)
  const outMo = reqMo * (workload.outputTokens || 0)
  const cacheRate = Math.max(0, Math.min(1, (workload.cachingHitRate || 0) / 100))
  const inPrice = model.inputPricePerMToken || 0
  const cachedPrice = Number.isFinite(model.cachedInputPrice)
    ? model.cachedInputPrice
    : inPrice * 0.1
  const inputCost = (inMo / 1_000_000) * (inPrice * (1 - cacheRate) + cachedPrice * cacheRate)
  const outputCost = (outMo / 1_000_000) * (model.outputPricePerMToken || 0)
  return inputCost + outputCost
}

function formatMonthly(n) {
  if (!Number.isFinite(n) || n < 0) return '$—'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K/mo`
  if (n >= 1) return `$${n.toFixed(0)}/mo`
  if (n > 0) return `$${n.toFixed(2)}/mo`
  return 'Free'
}

/**
 * Recommend the best models for a given workload.
 *
 * @param {Array}  models       Live model list (from useModelData)
 * @param {Object} workload     { requestsPerDay, inputTokens, outputTokens, cachingHitRate, scenarioMultiplier? }
 * @param {Object} options      { qualityFloor=50, budget=null, limit=3, requireOpen=false, requireContext=null }
 * @returns {Array<{ model, monthlyCost, score, reason, tag }>}
 */
export function recommendForWorkload(models, workload = {}, options = {}) {
  const {
    qualityFloor = 50,
    budget = null,
    limit = 3,
    requireOpen = false,
    requireContext = null,
  } = options

  if (!Array.isArray(models) || models.length === 0) return []

  // Effective volume (apply scenario multiplier if provided)
  const mult = Number.isFinite(workload.scenarioMultiplier) ? workload.scenarioMultiplier : 1
  const effectiveWorkload = {
    ...workload,
    requestsPerDay: (workload.requestsPerDay || 0) * mult,
  }

  // First pass: filter
  const candidates = models.filter(m => {
    if (!priced(m)) return false
    if (m.inputPricePerMToken === 0 && m.outputPricePerMToken === 0) return false // free models excluded — not "recommendable" for production scale
    if ((m.qualityScore || 0) < qualityFloor) return false
    if (requireOpen && m.license !== 'open') return false
    if (requireContext && (m.contextWindow || 0) < requireContext) return false
    return true
  })

  if (candidates.length === 0) return []

  // Compute monthly cost + composite score for each
  const scored = candidates.map(m => {
    const monthlyCost = projectMonthlyCost(m, effectiveWorkload)
    return { model: m, monthlyCost }
  })

  // Filter by budget if specified
  const withinBudget = budget != null
    ? scored.filter(c => c.monthlyCost <= budget)
    : scored

  if (withinBudget.length === 0) {
    // No model fits the budget — return cheapest 3 that meet quality, with a note
    return scored
      .sort((a, b) => a.monthlyCost - b.monthlyCost)
      .slice(0, limit)
      .map(c => ({
        ...c,
        score: 0,
        tag: 'over-budget',
        reason: `Above your $${budget}/mo budget at ${formatMonthly(c.monthlyCost)} — no candidate fits, this is the cheapest that meets arena score ${qualityFloor}+.`,
      }))
  }

  // Composite Pareto-aware score:
  //   score = arenaScore - 30 * log10(cost + 1)
  //
  // arenaScore = crowd-preference ELO mapped to 0-100 via ((elo-1100)/500)*100.
  // This rewards arena ranking linearly and penalizes log-cost. At equal score
  // the cheaper model wins; at equal cost the higher-ranked model wins.
  // The 30× coefficient balances the two axes roughly so a $1000/mo model
  // needs to be ~+90 arena score points to beat a $1/mo model.
  const ranked = withinBudget
    .map(c => {
      const q = c.model.qualityScore || 50
      const logCost = Math.log10(Math.max(c.monthlyCost, 0.01) + 1)
      const score = q - 30 * logCost
      return { ...c, score }
    })
    .sort((a, b) => b.score - a.score)

  // Tag top picks: 1st = primary, 2nd = runner-up, 3rd = budget pick (cheapest with decent arena score)
  const top = ranked.slice(0, limit)

  // Find the cheapest among the top half that still hits arenaScore≥qualityFloor+20
  const cheapestQuality = [...withinBudget]
    .filter(c => (c.model.qualityScore || 0) >= qualityFloor + 20)
    .sort((a, b) => a.monthlyCost - b.monthlyCost)[0]

  return top.map((c, i) => {
    let tag, reason
    const q = c.model.qualityScore || 50
    const cheaper = ranked.find(r => r.monthlyCost < c.monthlyCost && (r.model.qualityScore || 0) >= q * 0.85)
    if (i === 0) {
      tag = 'best-overall'
      reason = `Best balance: arena score ${q} at ${formatMonthly(c.monthlyCost)}.`
      if (c.model.arenaElo) reason += ` ELO ${c.model.arenaElo}.`
    } else if (cheapestQuality && c.model.id === cheapestQuality.model.id) {
      tag = 'cheapest-decent'
      reason = `Cheapest at arena score ≥ ${qualityFloor + 20}: ${formatMonthly(c.monthlyCost)}.`
    } else if (i === 1) {
      tag = 'runner-up'
      reason = `Runner-up: ${formatMonthly(c.monthlyCost)}, arena score ${q}.`
    } else {
      tag = 'alternative'
      reason = `Alternative: ${formatMonthly(c.monthlyCost)}, arena score ${q}.`
    }
    return { ...c, tag, reason }
  })
}
