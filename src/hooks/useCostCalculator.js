import { useMemo } from 'react'
import useDashboardStore from '../store/dashboardStore'
import { calculateCosts, generateVolumeCurve, generateScenarioComparison } from '../lib/costCalc'

export function useCostCalculator() {
  const inputs = useDashboardStore(s => s.calculatorInputs)

  const costs = useMemo(() => calculateCosts(inputs), [inputs])
  const volumeCurve = useMemo(() => generateVolumeCurve(inputs), [inputs])
  const scenarioComparison = useMemo(() => generateScenarioComparison(inputs), [inputs])

  return {
    costs,
    volumeCurve,
    scenarioComparison,
    inputs,
  }
}
