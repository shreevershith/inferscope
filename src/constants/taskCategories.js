// Token profiles: typical input/output token counts per single request for each
// task type.  Used by the Arena table's $/Task column to estimate what one API
// call costs.  These are representative averages — a coding task sends ~2K
// tokens of context and receives ~4K tokens of generated code, while a chat
// turn is much shorter.
export const TASK_CATEGORIES = [
  { id: 'all',       label: 'All Models', icon: 'apps',       tokenProfile: { inputTokens: 1000,  outputTokens: 1000, label: '1K in / 1K out' } },
  { id: 'code',      label: 'Code',       icon: 'terminal',   tokenProfile: { inputTokens: 2000,  outputTokens: 4000, label: '2K in / 4K out' } },
  { id: 'reasoning', label: 'Reasoning',  icon: 'psychology',  tokenProfile: { inputTokens: 1500,  outputTokens: 2000, label: '1.5K in / 2K out' } },
  { id: 'chat',      label: 'Chat',       icon: 'chat',       tokenProfile: { inputTokens: 500,   outputTokens: 200,  label: '500 in / 200 out' } },
  { id: 'creative',  label: 'Creative',   icon: 'palette',    tokenProfile: { inputTokens: 800,   outputTokens: 1500, label: '800 in / 1.5K out' } },
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
