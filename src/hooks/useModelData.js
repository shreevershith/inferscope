import useSWR from 'swr'
import { useEffect, useMemo } from 'react'
import { fetchOpenRouterModels, normalizeOpenRouterModel } from '../lib/openRouterClient'
import { fetchArenaLeaderboard, normalizeArenaModel } from '../lib/arenaClient'
import { mergeModelData } from '../lib/dataNormalizer'
import useDashboardStore from '../store/dashboardStore'

// localStorage cache — keeps the last-known-good merged result so a returning
// visitor sees real data instantly while SWR revalidates in the background.
// Bump the version suffix whenever the merged Model shape changes so old
// caches with stale data structures get invalidated automatically.
//   v1 → v2: provider prefix stripped from `name`, `isVariablePrice` added,
//            quality formula band widened
//   v2 → v3: description field added, taskStrengths now description-aware,
//            Arena ELO z-score-normalized across boards, provider names
//            prettified
const CACHE_KEY = 'inferscope-models-cache-v3'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24h — older than this, treat as stale

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.models || !Array.isArray(parsed.models) || !parsed.fetchedAt) return null
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage may be unavailable (Safari private mode, quota exceeded) — non-fatal
  }
}

const fetchAllModelData = async () => {
  const [openRouterRaw, arenaRaw] = await Promise.allSettled([
    fetchOpenRouterModels(),
    fetchArenaLeaderboard(),
  ])

  const sourceErrors = []
  if (openRouterRaw.status === 'rejected') {
    console.error('OpenRouter fetch failed:', openRouterRaw.reason?.message)
    sourceErrors.push('OpenRouter')
  }
  if (arenaRaw.status === 'rejected') {
    console.error('Arena fetch failed:', arenaRaw.reason?.message)
    sourceErrors.push('Arena')
  }

  // Per-item normalization with filter: drops malformed entries instead of failing entire batch.
  // No artificial top-N cap on OpenRouter — the full live catalog (~300+ models) is merged so
  // Arena ELO can attach to any model regardless of catalog position.
  const openRouterModels = openRouterRaw.status === 'fulfilled'
    ? openRouterRaw.value.map(normalizeOpenRouterModel).filter(Boolean)
    : []

  const arenaModels = arenaRaw.status === 'fulfilled'
    ? arenaRaw.value.map(normalizeArenaModel).filter(Boolean)
    : []

  const merged = mergeModelData({ arenaModels, openRouterModels })
  const fetchedAt = new Date().toISOString()
  const payload = { models: merged, sourceErrors, fetchedAt }

  // Cache only if we got real data from at least one source
  if (merged.length > 0 && sourceErrors.length < 2) {
    writeCache(payload)
  }

  return payload
}

export function useModelData() {
  const setModelList = useDashboardStore(s => s.setModelList)
  const setModelsLoading = useDashboardStore(s => s.setModelsLoading)
  const modelList = useDashboardStore(s => s.modelList)

  // Hydrate from disk cache once on mount so SWR never flashes empty.
  // useMemo([]) ensures readCache() + the wrapper object are created once —
  // without this, every render builds a new object, SWR returns it as `data`
  // (fetch still in-flight), the effect calls setModelList, Zustand re-renders,
  // and the cycle repeats → React error #185 (max update depth).
  const fallback = useMemo(() => {
    const cached = typeof window !== 'undefined' ? readCache() : null
    return cached
      ? { models: cached.models, sourceErrors: [], fetchedAt: cached.fetchedAt, fromCache: true }
      : undefined
  }, [])

  const { data, error, isLoading } = useSWR('model-data', fetchAllModelData, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000, // 1 hour
    dedupingInterval: 15 * 60 * 1000, // 15 min
    fallbackData: fallback,
  })

  useEffect(() => {
    setModelsLoading(isLoading)
  }, [isLoading, setModelsLoading])

  useEffect(() => {
    if (data?.models && data.models.length > 0) {
      setModelList(data.models, data.fetchedAt)
    }
  }, [data, setModelList])

  // Surface partial-failure state: data loaded, but one or more sources failed
  const sourceErrors = data?.sourceErrors || []
  const hasPartialFailure = sourceErrors.length > 0
  const hasTotalFailure = !!error || (data?.models?.length === 0 && hasPartialFailure)

  return {
    models: data?.models || modelList,
    isLoading,
    error,
    sourceErrors,
    fetchedAt: data?.fetchedAt,
    fromCache: !!data?.fromCache,
    hasPartialFailure,
    hasTotalFailure,
  }
}
