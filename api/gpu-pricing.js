// Live GPU pricing from Vast.ai public bundles API.
// Aggregates per-GPU model: median price/hr (per single GPU), VRAM, offer count, dlperf.
//
// Cached on Vercel edge via Cache-Control headers (1 hour).

export const config = {
  api: {
    bodyParser: false,
  },
}

const VAST_API = 'https://console.vast.ai/api/v0/bundles/'
const FETCH_TIMEOUT_MS = 10_000

// Filter: verified, on-demand, rentable, not external resellers
const VAST_QUERY = encodeURIComponent(JSON.stringify({
  verified: { eq: true },
  external: { eq: false },
  rentable: { eq: true },
  type: 'on-demand',
}))

function percentile(nums, p) {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo)
}
function median(nums) { return percentile(nums, 50) }

function normalizeGpuName(raw) {
  if (typeof raw !== 'string') return null
  // Trim, collapse whitespace, drop control chars
  return raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || null
}

export default async function handler(req, res) {
  // CORS hardening — matches /api/ai-chat. Without this, a hostile site can
  // hammer the endpoint to burn Vercel quota. When ALLOWED_ORIGIN is set in
  // production, only that origin gets the response.
  const allowedOrigin = process.env.ALLOWED_ORIGIN || ''
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${VAST_API}?q=${VAST_QUERY}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      console.error('Vast.ai API error:', response.status)
      return res.status(502).json({ error: 'GPU pricing upstream unavailable' })
    }

    const data = await response.json()
    const offers = Array.isArray(data?.offers) ? data.offers : []

    // Group by normalized GPU name
    const groups = new Map()
    for (const offer of offers) {
      const name = normalizeGpuName(offer.gpu_name)
      const numGpus = Number(offer.num_gpus) || 1
      const dphTotal = Number(offer.dph_total)
      const gpuRam = Number(offer.gpu_ram)  // MB per GPU
      const dlperf = Number(offer.dlperf)   // total perf
      if (!name || !Number.isFinite(dphTotal) || dphTotal <= 0) continue

      const pricePerGpuHr = dphTotal / numGpus
      const dlperfPerGpu = Number.isFinite(dlperf) && dlperf > 0 ? dlperf / numGpus : null

      if (!groups.has(name)) {
        groups.set(name, { prices: [], vrams: [], perfs: [], offerCount: 0 })
      }
      const g = groups.get(name)
      g.prices.push(pricePerGpuHr)
      if (Number.isFinite(gpuRam) && gpuRam > 0) g.vrams.push(gpuRam)
      if (dlperfPerGpu) g.perfs.push(dlperfPerGpu)
      g.offerCount += 1
    }

    // Build normalized list
    const gpus = []
    for (const [name, g] of groups) {
      if (g.offerCount < 1) continue
      const minPrice = Math.min(...g.prices)
      const p25 = percentile(g.prices, 25)
      const medianPrice = percentile(g.prices, 50)
      const p75 = percentile(g.prices, 75)
      const vramMB = g.vrams.length ? median(g.vrams) : 0
      const dlperf = g.perfs.length ? median(g.perfs) : 0
      gpus.push({
        gpu: name,
        vramGB: Math.round(vramMB / 1024),
        vramMB: Math.round(vramMB),
        minPricePerHour: Math.round(minPrice * 1000) / 1000,
        p25PricePerHour: Math.round(p25 * 1000) / 1000,
        medianPricePerHour: Math.round(medianPrice * 1000) / 1000,
        p75PricePerHour: Math.round(p75 * 1000) / 1000,
        dlperf: Math.round(dlperf * 10) / 10,
        offerCount: g.offerCount,
        provider: 'Vast.ai',
      })
    }

    // Sort: VRAM desc, then dlperf desc
    gpus.sort((a, b) => (b.vramGB - a.vramGB) || (b.dlperf - a.dlperf))

    // Cache 1h on edge, allow stale-while-revalidate for 24h
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json({
      gpus: gpus.slice(0, 40),
      source: 'vast.ai',
      fetchedAt: new Date().toISOString(),
      totalOffers: offers.length,
    })
  } catch (err) {
    console.error('GPU pricing fetch error:', err.message)
    return res.status(502).json({ error: 'GPU pricing temporarily unavailable' })
  } finally {
    clearTimeout(timeoutId)
  }
}
