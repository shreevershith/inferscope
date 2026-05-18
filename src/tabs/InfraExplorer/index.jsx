import { useState, useMemo } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { deriveProviders } from '../../constants/providerMetadata'
import { useGpuPricing } from '../../hooks/useGpuPricing'
import GpuCompareDrawer from './GpuCompareDrawer'
import { events } from '../../lib/telemetry'
import { formatRelativeTime } from '../../lib/timeUtils'

// Providers with fewer models than this threshold are folded into a
// collapsed "Other" section so the main grid stays scannable.
const MICRO_THRESHOLD = 3

export default function InfraExplorer() {
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const applyProviderToCalculator = useDashboardStore(s => s.applyProviderToCalculator)
  const modelList = useDashboardStore(s => s.modelList)
  const [compareGpus, setCompareGpus] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [showMicroProviders, setShowMicroProviders] = useState(false)

  // Live providers — derived from the OpenRouter model catalog.
  const allProviders = useMemo(() => deriveProviders(modelList), [modelList])
  const { primaryProviders, microProviders } = useMemo(() => {
    const primary = []
    const micro = []
    for (const p of allProviders) {
      if (p.models >= MICRO_THRESHOLD) primary.push(p)
      else micro.push(p)
    }
    return { primaryProviders: primary, microProviders: micro }
  }, [allProviders])

  // Live GPU pricing — fetched from Vast.ai via /api/gpu-pricing.
  const {
    gpus,
    isLoading: gpusLoading,
    error: gpusError,
    fetchedAt,
    source: gpuSource,
    totalOffers,
    fromCache: gpusFromCache,
    hasPartialFailure: gpusPartialFailure,
    hasTotalFailure: gpusTotalFailure,
  } = useGpuPricing()

  const handleEstimateCost = (provider) => {
    applyProviderToCalculator(provider)
    setActiveTab(1)
    events.providerEstimateCost(provider.name)
  }

  const toggleGpuCompare = (idx) => {
    setCompareGpus(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length >= 3 ? prev : [...prev, idx]
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <p className="label-micro mb-1 flex items-center gap-2">
            Operational Manifest
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-livePulse" />
          </p>
          <h2 className="text-xl sm:text-headline-sm font-black text-white">Infra Explorer</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Compare global inference endpoints and private GPU clusters in real-time.</p>
        </div>
        {fetchedAt && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-livePulse" />
            <span className="material-symbols-outlined text-sm">schedule</span>
            GPU data: {formatRelativeTime(fetchedAt)} · {totalOffers} live offers from {gpuSource}
          </p>
        )}
      </div>

      {/* API Providers */}
      <section data-tour="infra-providers">
        <h3 className="label-micro mb-6 flex items-center gap-2">
          API Providers
          <span className="text-[0.6rem] font-medium text-slate-500 normal-case tracking-normal">
            ({primaryProviders.length} primary{microProviders.length > 0 ? ` + ${microProviders.length} niche` : ''} · derived from {modelList.length} live models)
          </span>
        </h3>
        {primaryProviders.length === 0 && microProviders.length === 0 ? (
          <div className="dash-card p-8 text-center">
            <span className="material-symbols-outlined text-slate-600 text-3xl mb-2 block">cloud_off</span>
            <p className="text-sm text-slate-400">Waiting on live model data from OpenRouter…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-staggerIn">
            {primaryProviders.map(provider => (
              <div
                key={provider.id}
                className="dash-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(255,225,136,0.06)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">{provider.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white truncate">{provider.name}</h4>
                    <p className="text-xs text-slate-500">{provider.models} models · {provider.openModels} open</p>
                  </div>
                  {provider.topElo ? (
                    <span className="ml-auto text-[0.6rem] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-primary/20 text-primary" title="Top Arena ELO across this provider's models">
                      ELO {provider.topElo}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {provider.topModelName ? (
                    <>Top model: <span className="text-slate-200 font-medium">{provider.topModelName}</span></>
                  ) : (
                    <span className="text-slate-500">No leaderboard data yet</span>
                  )}
                </p>
                <p className="text-sm font-mono text-slate-200">{provider.priceRange} <span className="text-slate-500">/ M tokens</span></p>
                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() => handleEstimateCost(provider)}
                    className="flex-1 text-[0.65rem] font-black tracking-widest text-primary border border-primary/30 px-4 py-2 rounded hover:bg-primary hover:text-on-primary transition-all"
                  >
                    ESTIMATE COST
                  </button>
                  {provider.url && (
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => events.externalLink(provider.url, 'infra_provider')}
                      className="text-slate-500 hover:text-primary p-2 transition-colors"
                      title="Visit provider"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Niche providers (<3 models each) — collapsed by default */}
        {microProviders.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowMicroProviders(v => !v)}
              className="flex items-center gap-2 text-[0.65rem] font-black tracking-widest uppercase text-slate-500 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                {showMicroProviders ? 'expand_less' : 'expand_more'}
              </span>
              {showMicroProviders ? 'Hide' : 'Show'} {microProviders.length} niche providers
              <span className="text-slate-600 normal-case tracking-normal font-medium">
                (1–{MICRO_THRESHOLD - 1} models each)
              </span>
            </button>
            {showMicroProviders && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 animate-fadeIn">
                {microProviders.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => handleEstimateCost(provider)}
                    className="text-left p-2.5 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/30 hover:border-primary/30 transition-all flex items-center gap-2"
                    title={`${provider.models} model${provider.models === 1 ? '' : 's'} · ${provider.priceRange}`}
                  >
                    <span className="material-symbols-outlined text-primary/60 text-base shrink-0">{provider.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{provider.name}</p>
                      <p className="text-[0.6rem] text-slate-500">{provider.models}× · {provider.priceRange}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* GPU Pricing */}
      <section data-tour="infra-gpus">
        <div className="flex items-center justify-between mb-6">
          <h3 className="label-micro flex items-center gap-2">
            Self-Hosted GPU Pricing
            <span className="text-[0.6rem] font-medium text-slate-500 normal-case tracking-normal">
              {gpus.length > 0 ? `(${gpus.length} live configs)` : '(loading…)'}
            </span>
          </h3>
          {compareGpus.length >= 2 && (
            <button
              onClick={() => { setShowCompare(true); events.gpuCompareOpen(compareGpus.length) }}
              className="text-[0.65rem] font-black tracking-widest text-on-primary bg-primary px-4 py-2 rounded hover:opacity-90 transition-opacity flex items-center gap-2 animate-pulse"
            >
              <span className="material-symbols-outlined text-sm">compare</span>
              COMPARE SELECTED
            </button>
          )}
        </div>

        {/* Section-level error notice: fetch failed AND we're showing cached data.
            Matches the StaleCacheBanner pattern but scoped to this section so a
            partial outage doesn't trigger a global app-wide warning. */}
        {gpusPartialFailure && gpusFromCache && (
          <div role="status" className="mb-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs">
            <span className="material-symbols-outlined text-amber-400 text-base shrink-0">cloud_off</span>
            <p className="flex-1 dark:text-amber-100 text-amber-900 font-medium">
              GPU data from <span className="font-bold">{formatRelativeTime(fetchedAt)}</span> — Vast.ai unavailable, showing last good snapshot.
            </p>
          </div>
        )}

        {gpusTotalFailure ? (
          <div className="dash-card p-8 text-center">
            <span className="material-symbols-outlined text-error text-3xl mb-2 block">cloud_off</span>
            <p className="text-sm text-slate-300 font-medium">GPU pricing upstream unavailable</p>
            <p className="text-xs text-slate-500 mt-1">Vast.ai feed could not be reached and no cached snapshot exists. Retrying every 15 minutes.</p>
          </div>
        ) : gpusLoading && gpus.length === 0 ? (
          <div className="dash-card p-12 text-center">
            <div className="animate-pulse text-slate-400 text-sm">Loading live GPU offers…</div>
          </div>
        ) : (
          <div className="dash-card overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/40">
                    <th data-tour="infra-compare" className="px-4 py-4 w-10 text-center label-micro">☐</th>
                    <th className="px-6 py-4 label-micro">GPU Model</th>
                    <th className="px-6 py-4 label-micro">VRAM</th>
                    <th className="px-6 py-4 label-micro">Provider</th>
                    <th className="px-6 py-4 label-micro" title="Cheapest single-GPU offer currently listed.">$/hr (best)</th>
                    <th className="px-6 py-4 label-micro" title="Typical market range — 25th to 75th percentile of current offers.">$/hr (p25–p75)</th>
                    <th className="px-6 py-4 label-micro" title="Deep-learning perf score (higher = faster). Median across offers, per single GPU.">DL Perf</th>
                    <th className="px-6 py-4 label-micro">Offers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {gpus.map((gpu, i) => (
                    <tr key={`${gpu.gpu}-${i}`} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={compareGpus.includes(i)}
                          onChange={() => toggleGpuCompare(i)}
                          className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold text-white text-sm">{gpu.gpu}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">{gpu.vramGB}GB</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-primary/80 bg-primary/10 px-2 py-1 rounded">{gpu.provider}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-emerald-300">${gpu.minPricePerHour.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-white whitespace-nowrap">
                        {Number.isFinite(gpu.p25PricePerHour) && Number.isFinite(gpu.p75PricePerHour) && gpu.p25PricePerHour !== gpu.p75PricePerHour
                          ? <>${gpu.p25PricePerHour.toFixed(2)}<span className="text-slate-500"> – </span>${gpu.p75PricePerHour.toFixed(2)}</>
                          : <>${gpu.medianPricePerHour.toFixed(2)}</>}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-mono">{gpu.dlperf ? gpu.dlperf.toFixed(1) : '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{gpu.offerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* GPU Compare Drawer */}
      {showCompare && compareGpus.length >= 2 && (
        <GpuCompareDrawer
          gpus={compareGpus.map(i => gpus[i]).filter(Boolean)}
          onClose={() => setShowCompare(false)}
          onClearAll={() => { setCompareGpus([]); setShowCompare(false) }}
        />
      )}
    </div>
  )
}
