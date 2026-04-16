import { SCENARIO_MULTIPLIERS } from '../constants/taskCategories'

/**
 * Calculate monthly inference costs
 */
export function calculateCosts(inputs) {
  const {
    inputTokens,
    outputTokens,
    requestsPerDay,
    cachingHitRate,
    scenario,
    inputPricePerMToken,
    outputPricePerMToken,
    cachedInputPrice,
  } = inputs

  const multiplier = SCENARIO_MULTIPLIERS[scenario]?.requestMultiplier || 1.0
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
  const cacheSavings = costWithoutCaching - monthlyCost

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
 * Generate cost-vs-volume curve data
 */
export function generateVolumeCurve(inputs, points = 8) {
  const volumes = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000]
  return volumes.map(rpd => {
    const costs = calculateCosts({ ...inputs, requestsPerDay: rpd, scenario: 'base' })
    return {
      requestsPerDay: rpd,
      label: rpd >= 1000 ? `${(rpd / 1000).toFixed(0)}K` : rpd.toString(),
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
      scenario: SCENARIO_MULTIPLIERS[scenario].label,
      monthlyCost: costs.monthlyCost,
      annualCost: costs.annualCost,
      requestsPerDay: costs.volume.effectiveRequestsPerDay,
    }
  })
}
