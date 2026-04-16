export const TASK_CATEGORIES = [
  { id: 'all', label: 'All Models', icon: 'apps' },
  { id: 'code', label: 'Code', icon: 'terminal' },
  { id: 'reasoning', label: 'Reasoning', icon: 'psychology' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'creative', label: 'Creative', icon: 'palette' },
]

export const SCENARIO_MULTIPLIERS = {
  low: { requestMultiplier: 0.25, label: 'Low' },
  base: { requestMultiplier: 1.0, label: 'Base' },
  high: { requestMultiplier: 5.0, label: 'High' },
}
