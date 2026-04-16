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

  const openRouterModels = openRouterRaw.status === 'fulfilled'
    ? openRouterRaw.value.slice(0, 100).map(normalizeOpenRouterModel)
    : []

  const arenaModels = arenaRaw.status === 'fulfilled'
    ? arenaRaw.value.slice(0, 50).map(normalizeArenaModel)
    : []

  return mergeModelData({ arenaModels, openRouterModels })
}

export function useModelData() {
  const setModelList = useDashboardStore(s => s.setModelList)
  const setModelsLoading = useDashboardStore(s => s.setModelsLoading)
  const modelList = useDashboardStore(s => s.modelList)

  const { data, error, isLoading } = useSWR('model-data', fetchAllModelData, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000, // 1 hour
    dedupingInterval: 15 * 60 * 1000, // 15 min
    fallbackData: modelList.length > 0 ? modelList : undefined,
  })

  useEffect(() => {
    setModelsLoading(isLoading)
  }, [isLoading, setModelsLoading])

  useEffect(() => {
    if (data && data.length > 0) {
      setModelList(data)
    }
  }, [data, setModelList])

  return {
    models: data || modelList,
    isLoading,
    error,
  }
}
