import { useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#ffe188', '#4ade80', '#60a5fa']

const METRICS = [
  { key: 'vramNorm',       label: 'VRAM' },
  { key: 'priceInv',       label: 'Affordability' },
  { key: 'perfNorm',       label: 'DL Perf' },
  { key: 'efficiencyNorm', label: 'Efficiency' },
  { key: 'offersNorm',     label: 'Availability' },
]

export default function GpuCompareDrawer({ gpus, onClose, onClearAll }) {
  const radarData = useMemo(() => {
    if (!gpus || gpus.length === 0) return []
    const maxVram = Math.max(...gpus.map(g => g.vramGB || 0), 1)
    const maxPrice = Math.max(...gpus.map(g => g.medianPricePerHour || 0), 0.0001)
    const maxPerf = Math.max(...gpus.map(g => g.dlperf || 0), 1)
    const maxEfficiency = Math.max(...gpus.map(g => (g.dlperf || 0) / Math.max(g.medianPricePerHour || 0.0001, 0.0001)), 1)
    const maxOffers = Math.max(...gpus.map(g => g.offerCount || 0), 1)

    return METRICS.map(metric => {
      const point = { metric: metric.label }
      gpus.forEach((g, i) => {
        let val
        switch (metric.key) {
          case 'vramNorm':       val = ((g.vramGB || 0) / maxVram) * 100; break
          case 'priceInv':       val = (1 - (g.medianPricePerHour || 0) / maxPrice) * 100; break
          case 'perfNorm':       val = ((g.dlperf || 0) / maxPerf) * 100; break
          case 'efficiencyNorm': val = (((g.dlperf || 0) / Math.max(g.medianPricePerHour || 0.0001, 0.0001)) / maxEfficiency) * 100; break
          case 'offersNorm':     val = ((g.offerCount || 0) / maxOffers) * 100; break
          default: val = 0
        }
        point[`gpu${i}`] = Math.round(val)
      })
      return point
    })
  }, [gpus])

  if (!gpus || gpus.length === 0) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative bg-dash-card border-t border-slate-700/50 shadow-2xl shadow-black/50 rounded-t-2xl max-h-[70vh] overflow-y-auto">
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-6 pb-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">compare</span>
            GPU Comparison
            <span className="text-xs font-medium text-slate-400">({gpus.length} GPUs · live from Vast.ai)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button onClick={onClearAll} className="text-xs text-slate-400 hover:text-white transition-colors">
              Clear all
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pb-8">
          <div className="dash-card p-4">
            <h4 className="label-micro mb-3">Performance Radar</h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                {gpus.map((g, i) => (
                  <Radar
                    key={`${g.gpu}-${i}`}
                    name={`${g.gpu}`}
                    dataKey={`gpu${i}`}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="dash-card p-4 overflow-x-auto">
            <h4 className="label-micro mb-3">Detailed Comparison</h4>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-2 text-xs text-slate-400 font-bold">Metric</th>
                  {gpus.map((g, i) => (
                    <th key={`${g.gpu}-${i}`} className="py-2 text-xs font-bold" style={{ color: COLORS[i] }}>
                      {g.gpu}<br /><span className="font-normal text-slate-400">({g.provider})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {[
                  { label: 'VRAM', key: 'vramGB', fmt: v => `${v}GB`, best: 'max' },
                  { label: 'Best $/hr', key: 'minPricePerHour', fmt: v => `$${v.toFixed(2)}`, best: 'min' },
                  { label: 'Median $/hr', key: 'medianPricePerHour', fmt: v => `$${v.toFixed(2)}`, best: 'min' },
                  { label: 'DL Perf', key: 'dlperf', fmt: v => v ? v.toFixed(1) : '—', best: 'max' },
                  { label: 'Live offers', key: 'offerCount', fmt: v => v.toString(), best: 'max' },
                  { label: 'Perf / $', key: '_perfPerDollar', fmt: (_, g) => g.medianPricePerHour ? (g.dlperf / g.medianPricePerHour).toFixed(1) : '—', best: 'max' },
                  { label: 'VRAM / $', key: '_vramPerDollar', fmt: (_, g) => g.medianPricePerHour ? `${(g.vramGB / g.medianPricePerHour).toFixed(1)} GB/$` : '—', best: 'max' },
                ].map(row => {
                  const values = gpus.map(g => {
                    if (row.key === '_perfPerDollar') return g.medianPricePerHour ? g.dlperf / g.medianPricePerHour : null
                    if (row.key === '_vramPerDollar') return g.medianPricePerHour ? g.vramGB / g.medianPricePerHour : null
                    return typeof g[row.key] === 'number' ? g[row.key] : null
                  })
                  const numValues = values.filter(v => v !== null && Number.isFinite(v))
                  const bestVal = numValues.length
                    ? (row.best === 'max' ? Math.max(...numValues) : row.best === 'min' ? Math.min(...numValues) : null)
                    : null
                  return (
                    <tr key={row.label}>
                      <td className="py-2.5 text-xs text-slate-400 font-medium">{row.label}</td>
                      {gpus.map((g, i) => {
                        const val = values[i]
                        const isBest = bestVal !== null && val !== null && val === bestVal
                        return (
                          <td key={`${g.gpu}-${i}`} className={`py-2.5 text-xs font-medium ${isBest ? 'text-emerald-400 font-black' : 'text-slate-200'}`}>
                            {row.fmt(g[row.key], g)}
                            {isBest && <span className="ml-1 text-[8px]">★</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
