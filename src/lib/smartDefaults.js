// Suggested default token counts based on a selected model's likely use case.
// Inferred from the same task-strength tags we already compute. Returns a
// suggestion object the Cost Calculator can choose to apply — never mutates
// the user's current state without confirmation.
//
// The numbers are rough industry averages, not from any single source:
//   - Reasoning models (thinking variants) produce huge output relative to
//     input because of chain-of-thought
//   - Code models tend toward longer inputs (files / context) and medium
//     output
//   - Chat is short on both axes
//   - Large-context models in the 200K+ class are often used for RAG /
//     analysis with big inputs and short outputs

const PRESETS = {
  reasoning: {
    inputTokens: 800,
    outputTokens: 3000,
    requestsPerDay: 500,
    rationale: 'thinking models produce long chain-of-thought output',
  },
  code: {
    inputTokens: 2000,
    outputTokens: 600,
    requestsPerDay: 1500,
    rationale: 'code workloads tend to include surrounding file context',
  },
  creative: {
    inputTokens: 400,
    outputTokens: 1500,
    requestsPerDay: 200,
    rationale: 'creative generation outputs much more than the prompt',
  },
  chat: {
    inputTokens: 200,
    outputTokens: 150,
    requestsPerDay: 5000,
    rationale: 'short turn-based conversations',
  },
}

/**
 * Suggest defaults for a model. Returns null when the model is unknown or
 * its task strengths are too generic to specialize.
 *
 *   suggestDefaults(model) → { inputTokens, outputTokens, requestsPerDay, label, rationale } | null
 */
export function suggestDefaults(model) {
  if (!model || typeof model !== 'object') return null
  const tags = Array.isArray(model.taskStrengths) ? model.taskStrengths : []
  const ctx = Number(model.contextWindow) || 0

  // Large-context model + no obvious task hint → assume RAG / analysis
  if (ctx >= 200_000 && tags.length === 1 && tags[0] === 'chat') {
    return {
      ...PRESETS.chat,
      inputTokens: 5000,
      outputTokens: 500,
      requestsPerDay: 1000,
      label: 'RAG / long-context analysis',
      rationale: 'large context window suggests document analysis or RAG workloads',
    }
  }

  // Priority: reasoning > code > creative > chat. Reasoning models often
  // also have the code tag — we want the reasoning preset to win because the
  // output token count matters most for thinking models.
  const order = ['reasoning', 'code', 'creative', 'chat']
  for (const tag of order) {
    if (tags.includes(tag)) {
      return { ...PRESETS[tag], label: tag, rationale: PRESETS[tag].rationale }
    }
  }
  return null
}
