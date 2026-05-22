// Fetches live GPU pricing from our serverless proxy (/api/gpu-pricing).
// The proxy aggregates Vast.ai's public bundles API.

import { ApiClientError } from './ApiClientError'

const FETCH_TIMEOUT_MS = 12_000

export async function fetchGpuPricing() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch('/api/gpu-pricing', { signal: controller.signal })
    if (!res.ok) {
      throw new ApiClientError(`GPU pricing API error: ${res.status}`, { status: res.status, source: 'gpu-pricing' })
    }
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.gpus)) {
      throw new ApiClientError('GPU pricing API returned unexpected payload', { source: 'gpu-pricing' })
    }
    return {
      gpus: data.gpus,
      source: data.source || 'vast.ai',
      fetchedAt: data.fetchedAt,
      totalOffers: data.totalOffers,
    }
  } catch (err) {
    if (err instanceof ApiClientError) throw err
    throw new ApiClientError(err.message || 'GPU pricing fetch failed', { source: 'gpu-pricing', cause: err })
  } finally {
    clearTimeout(timeoutId)
  }
}
