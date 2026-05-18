import { SCENARIO_MULTIPLIERS } from '../constants/taskCategories'

/**
 * Coerce any value to a finite non-negative number.
 * Acts as a NaN firewall: invalid inputs become 0 instead of NaN propagating to the UI.
 */
function safeNum(value, fallback = 0) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

/**
 * Clamp a number into [min, max].
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Calculate monthly inference costs.
 * All inputs are validated and coerced. Never returns NaN.
 */
export function calculateCosts(inputs = {}) {
  const inputTokens = safeNum(inputs.inputTokens)
  const outputTokens = safeNum(inputs.outputTokens)
  const requestsPerDay = safeNum(inputs.requestsPerDay)
  const cachingHitRate = clamp(safeNum(inputs.cachingHitRate), 0, 100)
  const inputPricePerMToken = safeNum(inputs.inputPricePerMToken)
  const outputPricePerMToken = safeNum(inputs.outputPricePerMToken)
  // Cached price defaults to 10% of input price if not provided
  const cachedInputPrice = inputs.cachedInputPrice != null
    ? safeNum(inputs.cachedInputPrice)
    : inputPricePerMToken * 0.1

  // Per-user override wins over the default constant.
  const override = inputs.scenarioOverrides?.[inputs.scenario]
  const scenarioCfg = SCENARIO_MULTIPLIERS[inputs.scenario]
  const multiplier = Number.isFinite(override) && override >= 0
    ? safeNum(override, 1.0)
    : (scenarioCfg ? safeNum(scenarioCfg.requestMultiplier, 1.0) : 1.0)
  const effectiveRequestsPerDay = requestsPerDay * multiplier
  const requestsPerMonth = effectiveRequestsPerDay * 30

  // Token volumes per month
  const totalInputTokens = requestsPerMonth * inputTokens
  const totalOutputTokens = requestsPerMonth * outputTokens

  // Split input tokens into cached vs uncached
  const cacheRate = cachingHitRate / 100
  const cachedInputTokens = totalInputTokens * cacheRate
  const uncachedInputTokens = totalInputTokens * (1 - cacheRate)

  // Costs
  const uncachedInputCost = (uncachedInputTokens / 1_000_000) * inputPricePerMToken
  const cachedInputCost = (cachedInputTokens / 1_000_000) * cachedInputPrice
  const outputCost = (totalOutputTokens / 1_000_000) * outputPricePerMToken
  const totalInputCost = uncachedInputCost + cachedInputCost

  const monthlyCost = totalInputCost + outputCost
  const costPerRequest = requestsPerMonth > 0 ? monthlyCost / requestsPerMonth : 0
  const annualCost = monthlyCost * 12

  // Savings from caching
  const costWithoutCaching = (totalInputTokens / 1_000_000) * inputPricePerMToken + outputCost
  const cacheSavings = Math.max(0, costWithoutCaching - monthlyCost)

  // Blended cost per 1M tokens
  const totalTokens = totalInputTokens + totalOutputTokens
  const blendedPerMToken = totalTokens > 0 ? (monthlyCost / totalTokens) * 1_000_000 : 0

  return {
    monthlyCost,
    costPerRequest,
    annualCost,
    cacheSavings,
    blendedPerMToken,
    breakdown: {
      inputCost: totalInputCost,
      outputCost,
      cachedSavings: cacheSavings,
    },
    volume: {
      requestsPerMonth,
      totalInputTokens,
      totalOutputTokens,
      effectiveRequestsPerDay,
    },
  }
}

/**
 * Generate log-spaced volume sweep points centered on the user's current
 * requestsPerDay. Spans ~2 orders of magnitude below and ~1.5 above so the
 * user's input sits roughly in the middle of the chart.
 */
export function getAdaptiveVolumeTicks(requestsPerDay) {
  const center = Math.max(10, safeNum(requestsPerDay, 1000))
  const factors = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30]
  const raw = factors.map(f => Math.max(10, Math.round(center * f)))
  // De-duplicate (small inputs collapse low end) and sort
  return [...new Set(raw)].sort((a, b) => a - b)
}

/**
 * Generate cost-vs-volume curve data adapted to the user's input.
 */
export function generateVolumeCurve(inputs) {
  const volumes = getAdaptiveVolumeTicks(inputs?.requestsPerDay)
  return volumes.map(rpd => {
    const costs = calculateCosts({ ...inputs, requestsPerDay: rpd, scenario: 'base' })
    return {
      requestsPerDay: rpd,
      label: rpd >= 1_000_000 ? `${(rpd / 1_000_000).toFixed(1)}M`
        : rpd >= 1000 ? `${(rpd / 1000).toFixed(rpd >= 10000 ? 0 : 1)}K`
        : rpd.toString(),
      monthlyCost: costs.monthlyCost,
    }
  })
}

/**
 * Generate scenario comparison data
 */
export function generateScenarioComparison(inputs) {
  return ['low', 'base', 'high'].map(scenario => {
    const costs = calculateCosts({ ...inputs, scenario })
    return {
      scenario: SCENARIO_MULTIPLIERS[scenario]?.label || scenario,
      monthlyCost: costs.monthlyCost,
      annualCost: costs.annualCost,
      requestsPerDay: costs.volume.effectiveRequestsPerDay,
    }
  })
}
