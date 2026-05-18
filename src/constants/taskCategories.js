export const TASK_CATEGORIES = [
  { id: 'all', label: 'All Models', icon: 'apps' },
  { id: 'code', label: 'Code', icon: 'terminal' },
  { id: 'reasoning', label: 'Reasoning', icon: 'psychology' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'creative', label: 'Creative', icon: 'palette' },
]

// Default traffic-scenario multipliers. The Cost Calculator stores any user
// overrides in the Zustand `calculatorInputs.scenarioOverrides` map; readers
// should consult `getEffectiveScenarios()` (see store) rather than this
// constant directly so user customizations take precedence.
export const SCENARIO_MULTIPLIERS = {
  low:   { requestMultiplier: 0.25, label: 'Low',   hint: 'Dev / staging / off-peak' },
  base:  { requestMultiplier: 1.0,  label: 'Base',  hint: 'Production baseline' },
  high:  { requestMultiplier: 5.0,  label: 'High',  hint: 'Sustained peak' },
  spike: { requestMultiplier: 20.0, label: 'Spike', hint: 'Bursts, campaigns, viral' },
}
