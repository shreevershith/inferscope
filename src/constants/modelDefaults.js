// Last-resort fallback shown ONLY when both OpenRouter and Arena
// leaderboard upstreams fail simultaneously AND no localStorage cache exists.
// Kept intentionally small — this is an offline error state, not a data
// source. Live data flows through useModelData → dataNormalizer.mergeModelData.
//
// If you see these names in the UI, both APIs are down.
export const FALLBACK_MODELS = [
  {
    id: 'unavailable',
    name: 'Live data unavailable',
    provider: 'System',
    providerIcon: 'cloud_off',
    arenaElo: 0,
    qualityScore: 0,
    inputPricePerMToken: 0,
    outputPricePerMToken: 0,
    cachedInputPrice: 0,
    tokensPerSecond: 0,
    contextWindow: 0,
    contextLabel: '—',
    license: 'unknown',
    modalities: ['text'],
    taskStrengths: ['chat'],
  },
]
