import { useMemo } from 'react'
import useDashboardStore from '../store/dashboardStore'
import { calculateCosts, generateVolumeCurve, generateScenarioComparison } from '../lib/costCalc'

export function useCostCalculator() {
  const inputTokens = useDashboardStore(s => s.calculatorInputs.inputTokens)
  const outputTokens = useDashboardStore(s => s.calculatorInputs.outputTokens)
  const requestsPerDay = useDashboardStore(s => s.calculatorInputs.requestsPerDay)
  const cachingHitRate = useDashboardStore(s => s.calculatorInputs.cachingHitRate)
  const inputPricePerMToken = useDashboardStore(s => s.calculatorInputs.inputPricePerMToken)
  const outputPricePerMToken = useDashboardStore(s => s.calculatorInputs.outputPricePerMToken)
  const cachedInputPrice = useDashboardStore(s => s.calculatorInputs.cachedInputPrice)
  const scenario = useDashboardStore(s => s.calculatorInputs.scenario)
  const scenarioOverrides = useDashboardStore(s => s.calculatorInputs.scenarioOverrides)

  const calcInputs = useMemo(() => ({
    inputTokens, outputTokens, requestsPerDay, cachingHitRate,
    inputPricePerMToken, outputPricePerMToken, cachedInputPrice,
    scenario, scenarioOverrides,
  }), [inputTokens, outputTokens, requestsPerDay, cachingHitRate,
    inputPricePerMToken, outputPricePerMToken, cachedInputPrice,
    scenario, scenarioOverrides])

  const costs = useMemo(() => calculateCosts(calcInputs), [calcInputs])
  const volumeCurve = useMemo(() => generateVolumeCurve(calcInputs), [calcInputs])
  const scenarioComparison = useMemo(() => generateScenarioComparison(calcInputs), [calcInputs])

  const inputs = useDashboardStore(s => s.calculatorInputs)

  return {
    costs,
    volumeCurve,
    scenarioComparison,
    inputs,
  }
}
