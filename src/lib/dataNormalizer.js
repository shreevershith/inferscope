import { SEED_MODELS } from '../constants/modelDefaults'

/**
 * Merge data from multiple sources into unified Model objects.
 * Priority: Arena ELO > OpenRouter pricing > seed defaults.
 */
export function mergeModelData({ arenaModels = [], openRouterModels = [] }) {
  const merged = new Map()

  // Start with seed data as base
  for (const seed of SEED_MODELS) {
    merged.set(seed.id, { ...seed })
  }

  // Layer OpenRouter pricing data
  for (const orModel of openRouterModels) {
    const matchKey = findMatchKey(merged, orModel.name, orModel.id)
    if (matchKey) {
      const existing = merged.get(matchKey)
      merged.set(matchKey, {
        ...existing,
        inputPricePerMToken: orModel.inputPricePerMToken || existing.inputPricePerMToken,
        outputPricePerMToken: orModel.outputPricePerMToken || existing.outputPricePerMToken,
        cachedInputPrice: orModel.cachedInputPrice || existing.cachedInputPrice,
        contextWindow: orModel.contextWindow || existing.contextWindow,
        contextLabel: orModel.contextLabel || existing.contextLabel,
        modalities: orModel.modalities?.length ? orModel.modalities : existing.modalities,
        openRouterId: orModel.id,
      })
    }
  }

  // Layer Arena ELO scores
  for (const arena of arenaModels) {
    const matchKey = findMatchKey(merged, arena.name)
    if (matchKey) {
      const existing = merged.get(matchKey)
      merged.set(matchKey, {
        ...existing,
        arenaElo: arena.arenaElo || existing.arenaElo,
        voteCount: arena.voteCount || existing.voteCount,
      })
    }
  }

  // Convert to array, compute quality scores, sort by ELO
  const models = Array.from(merged.values())
    .map(m => ({
      ...m,
      qualityScore: m.qualityScore || computeQualityScore(m),
      lastUpdated: new Date().toISOString().split('T')[0],
    }))
    .sort((a, b) => (b.arenaElo || 0) - (a.arenaElo || 0))
    .map((m, i) => ({ ...m, rank: i + 1 }))

  return models
}

function findMatchKey(map, name, id) {
  if (!name && !id) return null
  const normalize = s => s?.toLowerCase().replace(/[-_\s.]/g, '') || ''

  // Direct ID match
  for (const [key] of map) {
    if (normalize(key) === normalize(id)) return key
  }

  // Name fuzzy match
  const normalizedName = normalize(name)
  for (const [key, value] of map) {
    if (normalize(value.name).includes(normalizedName) || normalizedName.includes(normalize(value.name))) {
      return key
    }
  }

  return null
}

function computeQualityScore(model) {
  if (model.arenaElo) {
    // Normalize ELO to 0-100 scale (roughly 1100-1350 range)
    return Math.min(100, Math.max(0, ((model.arenaElo - 1100) / 250) * 100))
  }
  return 50
}
