// Fetches live GPU pricing from our serverless proxy (/api/gpu-pricing).
// The proxy aggregates Vast.ai's public bundles API.

const FETCH_TIMEOUT_MS = 12_000

export async function fetchGpuPricing() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch('/api/gpu-pricing', { signal: controller.signal })
    if (!res.ok) {
      const error = new Error(`GPU pricing API error: ${res.status}`)
      error.status = res.status
      error.source = 'gpu-pricing'
      throw error
    }
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.gpus)) {
      const error = new Error('GPU pricing API returned unexpected payload')
      error.source = 'gpu-pricing'
      throw error
    }
    return {
      gpus: data.gpus,
      source: data.source || 'vast.ai',
      fetchedAt: data.fetchedAt,
      totalOffers: data.totalOffers,
    }
  } catch (err) {
    if (!err.source) err.source = 'gpu-pricing'
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
