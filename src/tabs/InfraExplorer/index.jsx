import { useState } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { PROVIDERS, GPU_PRICING } from '../../constants/providerMetadata'

export default function InfraExplorer() {
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const applyProviderToCalculator = useDashboardStore(s => s.applyProviderToCalculator)
  const [compareGpus, setCompareGpus] = useState([])

  const handleEstimateCost = (provider) => {
    applyProviderToCalculator(provider)
    setActiveTab(1)
  }

  const toggleGpuCompare = (idx) => {
    setCompareGpus(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : prev.length >= 3 ? prev : [...prev, idx]
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="label-micro mb-1">Operational Manifest</p>
        <h2 className="text-xl sm:text-headline-sm font-black text-white">Infra Explorer</h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">Compare global inference endpoints and private GPU clusters in real-time.</p>
      </div>

      {/* API Providers */}
      <section>
        <h3 className="label-micro mb-6">API Providers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-staggerIn">
          {PROVIDERS.map(provider => (
            <div key={provider.id} className="dash-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">{provider.icon}</span>
                </div>
                <div>
                  <h4 className="font-bold text-white">{provider.name}</h4>
                  <p className="text-xs text-slate-500">Models: {provider.models}</p>
                </div>
                <span className={`ml-auto text-[0.6rem] font-black tracking-wider uppercase px-2 py-0.5 rounded ${
                  provider.speedTier === 'Ultra-fast' ? 'bg-primary/20 text-primary' :
                  provider.speedTier === 'Fast' ? 'bg-slate-700 text-slate-300' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {provider.speedTier}
                </span>
              </div>
              <p className="text-xs text-slate-400">{provider.description}</p>
              <p className="text-sm font-mono text-slate-200">{provider.priceRange} <span className="text-slate-500">/ M tokens</span></p>
              <button
                onClick={() => handleEstimateCost(provider)}
                className="mt-auto text-[0.65rem] font-black tracking-widest text-primary border border-primary/30 px-4 py-2 rounded hover:bg-primary hover:text-on-primary transition-all w-full"
              >
                ESTIMATE COST
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* GPU Pricing */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="label-micro">GPU Pricing — Self-Hosted</h3>
          {compareGpus.length >= 2 && (
            <button className="text-[0.65rem] font-black tracking-widest text-on-primary bg-primary px-4 py-2 rounded hover:opacity-90 transition-opacity flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">compare</span>
              COMPARE SELECTED
            </button>
          )}
        </div>
        <div className="dash-card overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/40">
                  <th className="px-4 py-4 w-10 text-center label-micro">☐</th>
                  <th className="px-6 py-4 label-micro">GPU Model</th>
                  <th className="px-6 py-4 label-micro">VRAM</th>
                  <th className="px-6 py-4 label-micro">Provider</th>
                  <th className="px-6 py-4 label-micro">$/hr</th>
                  <th className="px-6 py-4 label-micro">Throughput</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {GPU_PRICING.map((gpu, i) => (
                  <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={compareGpus.includes(i)}
                        onChange={() => toggleGpuCompare(i)}
                        className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-white text-sm">{gpu.gpu}</td>
                    <td className="px-6 py-4 text-xs text-slate-300">{gpu.vram}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-primary/80 bg-primary/10 px-2 py-1 rounded">{gpu.provider}</span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-white">${gpu.pricePerHour.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{gpu.throughput}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
