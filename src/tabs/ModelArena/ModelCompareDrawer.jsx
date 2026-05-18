import { useMemo } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#ffe188', '#4ade80', '#60a5fa']

// Radar metrics — Speed dropped (no live tokens/sec source). Replaced with
// Output-cost affordability so the radar covers both input and output pricing.
const METRICS = [
  { key: 'qualityScore', label: 'Quality', max: 100 },
  { key: 'valueScore', label: 'Value', max: 150 },
  { key: 'contextNorm', label: 'Context', max: 100 },
  { key: 'priceInv', label: 'Input Affordability', max: 100 },
  { key: 'outputPriceInv', label: 'Output Affordability', max: 100 },
]

function normalize(value, max) {
  return Math.min(100, Math.max(0, (value / max) * 100))
}

export default function ModelCompareDrawer({ models, onClose, onClearAll }) {
  // Normalize data for radar chart
  const radarData = useMemo(() => {
    const maxContext = Math.max(...models.map(m => m.contextWindow || 0), 1)
    const maxInputPrice = Math.max(...models.map(m => m.inputPricePerMToken || 0), 1)
    const maxOutputPrice = Math.max(...models.map(m => m.outputPricePerMToken || 0), 1)

    return METRICS.map(metric => {
      const point = { metric: metric.label }
      models.forEach((m, i) => {
        let val
        switch (metric.key) {
          case 'qualityScore':   val = m.qualityScore || 50; break
          case 'valueScore':     val = Math.min(100, (m.valueScore || 0) * 0.7); break
          case 'contextNorm':    val = ((m.contextWindow || 0) / maxContext) * 100; break
          case 'priceInv':       val = (1 - (m.inputPricePerMToken || 0) / maxInputPrice) * 100; break
          case 'outputPriceInv': val = (1 - (m.outputPricePerMToken || 0) / maxOutputPrice) * 100; break
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
                  { label: 'Input $/M', key: 'inputPricePerMToken', fmt: v => v != null ? `$${v.toFixed(2)}` : '—', best: 'min' },
                  { label: 'Output $/M', key: 'outputPricePerMToken', fmt: v => v != null ? `$${v.toFixed(2)}` : '—', best: 'min' },
                  {
                    label: 'Cost / Quality',
                    key: '_costPerQuality',
                    // (input + output) ÷ qualityScore. Lower = more value-per-quality-point.
                    // A model at $3 in / $15 out with quality 90 → (3+15)/90 = 0.20
                    fmt: (_, m) => {
                      const q = m.qualityScore || 0
                      const inP = m.inputPricePerMToken
                      const outP = m.outputPricePerMToken
                      if (!q || inP == null || outP == null) return '—'
                      const total = inP + outP
                      if (total <= 0) return 'Free'
                      return `$${(total / q).toFixed(3)}`
                    },
                    best: 'min',
                  },
                  { label: 'Context', key: 'contextLabel', fmt: v => v || '—' },
                  { label: 'License', key: 'license', fmt: v => v || '—' },
                  { label: 'Modalities', key: 'modalities', fmt: v => v?.join(', ') || '—' },
                ].map(row => {
                  // Computed-key rows (prefix `_`) don't read from m[key] directly —
                  // they need the model to derive a value. Extract here so the
                  // best-pick highlight works for them too.
                  const valueOf = (m) => {
                    if (row.key === '_costPerQuality') {
                      const q = m.qualityScore || 0
                      const inP = m.inputPricePerMToken
                      const outP = m.outputPricePerMToken
                      if (!q || inP == null || outP == null) return null
                      const total = inP + outP
                      return total > 0 ? total / q : null
                    }
                    const raw = m[row.key]
                    return typeof raw === 'number' ? raw : null
                  }
                  const values = models.map(valueOf)
                  const numValues = values.filter(v => v != null && Number.isFinite(v))
                  const bestVal = numValues.length > 0
                    ? (row.best === 'max' ? Math.max(...numValues) : row.best === 'min' ? Math.min(...numValues) : null)
                    : null
                  return (
                    <tr key={row.label}>
                      <td className="py-2.5 text-xs text-slate-400 font-medium">{row.label}</td>
                      {models.map((m, i) => {
                        const num = values[i]
                        const isBest = bestVal !== null && num != null && num === bestVal
                        return (
                          <td key={m.id} className={`py-2.5 text-xs font-medium ${isBest ? 'text-emerald-400 font-black' : 'text-slate-200'}`}>
                            {row.fmt(m[row.key], m)}
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
