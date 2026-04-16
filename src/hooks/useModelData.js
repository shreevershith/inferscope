import useSWR from 'swr'
import { fetchOpenRouterModels, normalizeOpenRouterModel } from '../lib/openRouterClient'
import { fetchArenaLeaderboard, normalizeArenaModel } from '../lib/arenaClient'
import { mergeModelData } from '../lib/dataNormalizer'
import useDashboardStore from '../store/dashboardStore'
import { useEffect } from 'react'

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

  // Per-item normalization with filter: drops malformed entries instead of failing entire batch
  const openRouterModels = openRouterRaw.status === 'fulfilled'
    ? openRouterRaw.value.slice(0, 100).map(normalizeOpenRouterModel).filter(Boolean)
    : []

  const arenaModels = arenaRaw.status === 'fulfilled'
    ? arenaRaw.value.slice(0, 50).map(normalizeArenaModel).filter(Boolean)
    : []

  const merged = mergeModelData({ arenaModels, openRouterModels })

  return { models: merged, sourceErrors }
}

export function useModelData() {
  const setModelList = useDashboardStore(s => s.setModelList)
  const setModelsLoading = useDashboardStore(s => s.setModelsLoading)
  const modelList = useDashboardStore(s => s.modelList)

  const { data, error, isLoading } = useSWR('model-data', fetchAllModelData, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000, // 1 hour
    dedupingInterval: 15 * 60 * 1000, // 15 min
    fallbackData: modelList.length > 0 ? { models: modelList, sourceErrors: [] } : undefined,
  })

  useEffect(() => {
    setModelsLoading(isLoading)
  }, [isLoading, setModelsLoading])

  useEffect(() => {
    if (data?.models && data.models.length > 0) {
      setModelList(data.models)
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
    hasPartialFailure,
    hasTotalFailure,
  }
}
