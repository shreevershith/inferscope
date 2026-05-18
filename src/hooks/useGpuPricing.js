import useSWR from 'swr'
import { fetchGpuPricing } from '../lib/gpuPricingClient'

// localStorage cache — same pattern as useModelData. Keeps the last good
// Vast.ai snapshot so users see real GPUs on first paint even when the
// upstream is slow or briefly unreachable. Bump the version suffix on
// any payload shape change.
const CACHE_KEY = 'inferscope-gpu-pricing-cache-v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24h

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.gpus || !Array.isArray(parsed.gpus) || !parsed.fetchedAt) return null
    if (Date.now() - new Date(parsed.fetchedAt).getTime() > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)) } catch {}
}

async function fetchAndCache() {
  const result = await fetchGpuPricing()
  if (result?.gpus?.length > 0) writeCache(result)
  return result
}

/**
 * Live GPU pricing from Vast.ai via /api/gpu-pricing.
 * Refreshes hourly to match upstream cache.
 *
 * Returns the same error-shape contract as useModelData so consumers can
 * uniformly render full-failure / partial-failure / stale-cache UI:
 *   { gpus, source, fetchedAt, totalOffers, isLoading, error,
 *     fromCache, sourceErrors, hasPartialFailure, hasTotalFailure }
 */
export function useGpuPricing() {
  const cached = typeof window !== 'undefined' ? readCache() : null
  const fallbackData = cached
    ? { ...cached, fromCache: true }
    : undefined

  const { data, error, isLoading } = useSWR('gpu-pricing', fetchAndCache, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,   // 1 hour
    dedupingInterval: 15 * 60 * 1000,  // 15 min
    shouldRetryOnError: true,
    errorRetryCount: 2,
    fallbackData,
  })

  const gpus = data?.gpus || []
  const fromCache = !!data?.fromCache
  const sourceErrors = error ? ['Vast.ai'] : []
  const hasPartialFailure = sourceErrors.length > 0 && gpus.length > 0
  const hasTotalFailure = sourceErrors.length > 0 && gpus.length === 0

  return {
    gpus,
    source: data?.source,
    fetchedAt: data?.fetchedAt,
    totalOffers: data?.totalOffers || 0,
    isLoading,
    error,
    fromCache,
    sourceErrors,
    hasPartialFailure,
    hasTotalFailure,
  }
}
