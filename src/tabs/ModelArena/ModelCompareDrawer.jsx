import { useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#ffe188', '#4ade80', '#60a5fa']

const METRICS = [
  { key: 'qualityScore', label: 'Quality', max: 100 },
  { key: 'valueScore', label: 'Value', max: 150 },
  { key: 'speedNorm', label: 'Speed', max: 100 },
  { key: 'contextNorm', label: 'Context', max: 100 },
  { key: 'priceInv', label: 'Affordability', max: 100 },
]

function normalize(value, max) {
  return Math.min(100, Math.max(0, (value / max) * 100))
}

export default function ModelCompareDrawer({ models, onClose, onClearAll }) {
  // Normalize data for radar chart
  const radarData = useMemo(() => {
    const maxSpeed = Math.max(...models.map(m => m.tokensPerSecond || 0), 1)
    const maxContext = Math.max(...models.map(m => m.contextWindow || 0), 1)
    const maxPrice = Math.max(...models.map(m => m.inputPricePerMToken || 0), 1)

    return METRICS.map(metric => {
      const point = { metric: metric.label }
      models.forEach((m, i) => {
        let val
        switch (metric.key) {
          case 'qualityScore': val = m.qualityScore || 50; break
          case 'valueScore': val = Math.min(100, (m.valueScore || 0) * 0.7); break
          case 'speedNorm': val = ((m.tokensPerSecond || 0) / maxSpeed) * 100; break
          case 'contextNorm': val = ((m.contextWindow || 0) / maxContext) * 100; break
          case 'priceInv': val = (1 - (m.inputPricePerMToken || 0) / maxPrice) * 100; break
          default: val = 0
        }
        point[`model${i}`] = Math.round(val)
      })
      return point
    })
  }, [models])

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative bg-dash-card border-t border-slate-700/50 shadow-2xl shadow-black/50 rounded-t-2xl max-h-[70vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">compare</span>
            Model Comparison
            <span className="text-xs font-medium text-slate-400">({models.length} models)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onClearAll}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 pb-8">
          {/* Radar Chart */}
          <div className="dash-card p-4">
            <h4 className="label-micro mb-3">Performance Radar</h4>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                />
                {models.map((m, i) => (
                  <Radar
                    key={m.id}
                    name={m.name}
                    dataKey={`model${i}`}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Side-by-side Stats */}
          <div className="dash-card p-4 overflow-x-auto">
            <h4 className="label-micro mb-3">Detailed Comparison</h4>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="py-2 text-xs text-slate-400 font-bold">Metric</th>
                  {models.map((m, i) => (
                    <th key={m.id} className="py-2 text-xs font-bold" style={{ color: COLORS[i] }}>
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {[
                  { label: 'Arena ELO', key: 'arenaElo', fmt: v => v || '—', best: 'max' },
                  { label: 'Quality', key: 'qualityScore', fmt: v => `${v || 0}/100`, best: 'max' },
                  { label: 'Value Score', key: 'valueScore', fmt: v => v || 0, best: 'max' },
                  { label: 'Input $/M', key: 'inputPricePerMToken', fmt: v => `$${v?.toFixed(2) || '—'}`, best: 'min' },
                  { label: 'Output $/M', key: 'outputPricePerMToken', fmt: v => `$${v?.toFixed(2) || '—'}`, best: 'min' },
                  { label: 'Speed', key: 'tokensPerSecond', fmt: v => v ? `${v} tok/s` : '—', best: 'max' },
                  { label: 'Context', key: 'contextLabel', fmt: v => v || '—' },
                  { label: 'License', key: 'license', fmt: v => v || '—' },
                  { label: 'Modalities', key: 'modalities', fmt: v => v?.join(', ') || '—' },
                ].map(row => {
                  const values = models.map(m => m[row.key])
                  const numValues = values.map(v => typeof v === 'number' ? v : null).filter(Boolean)
                  const bestVal = row.best === 'max' ? Math.max(...numValues) : row.best === 'min' ? Math.min(...numValues) : null
                  return (
                    <tr key={row.label}>
                      <td className="py-2.5 text-xs text-slate-400 font-medium">{row.label}</td>
                      {models.map((m, i) => {
                        const val = m[row.key]
                        const isBest = bestVal !== null && typeof val === 'number' && val === bestVal
                        return (
                          <td key={m.id} className={`py-2.5 text-xs font-medium ${isBest ? 'text-emerald-400 font-black' : 'text-slate-200'}`}>
                            {row.fmt(val)}
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
