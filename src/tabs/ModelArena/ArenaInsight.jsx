import { useState, useMemo } from 'react'

const VIEWS = [
  { id: 'elo', label: 'ELO Ranking', icon: 'leaderboard' },
  { id: 'price', label: 'Price', icon: 'payments' },
  { id: 'speed', label: 'Speed', icon: 'speed' },
  { id: 'value', label: 'Value Score', icon: 'thumb_up' },
]

export default function ArenaInsight({ models, filteredModels, highlightedModelId, onModelClick }) {
  const [activeView, setActiveView] = useState('elo')

  const chartData = useMemo(() => {
    const source = filteredModels.length > 0 ? filteredModels : models
    const top6 = source.slice(0, 6)

    switch (activeView) {
      case 'elo':
        return top6.map(m => ({
          id: m.id,
          name: m.name,
          value: m.arenaElo || 0,
          label: m.arenaElo?.toString() || '—',
          maxVal: Math.max(...top6.map(x => x.arenaElo || 0)),
          minVal: Math.min(...top6.map(x => x.arenaElo || 1100)),
        }))
      case 'price':
        return [...top6].sort((a, b) => (a.inputPricePerMToken || 0) - (b.inputPricePerMToken || 0)).map(m => ({
          id: m.id,
          name: m.name,
          value: m.inputPricePerMToken || 0,
          label: `$${m.inputPricePerMToken?.toFixed(2) || '0'}`,
          maxVal: Math.max(...top6.map(x => x.inputPricePerMToken || 0)),
          minVal: 0,
          invert: true, // lower is better for price
        }))
      case 'speed':
        return [...top6].sort((a, b) => (b.tokensPerSecond || 0) - (a.tokensPerSecond || 0)).map(m => ({
          id: m.id,
          name: m.name,
          value: m.tokensPerSecond || 0,
          label: `${m.tokensPerSecond || 0} t/s`,
          maxVal: Math.max(...top6.map(x => x.tokensPerSecond || 0)),
          minVal: 0,
        }))
      case 'value':
        return [...top6].sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0)).map(m => ({
          id: m.id,
          name: m.name,
          value: m.valueScore || 0,
          label: m.valueScore?.toString() || '0',
          maxVal: Math.max(...top6.map(x => x.valueScore || 0)),
          minVal: 0,
        }))
      default:
        return []
    }
  }, [models, filteredModels, activeView])

  const getBarColor = (item, i) => {
    if (highlightedModelId === item.id) return 'rgba(255, 225, 136, 1)'
    if (item.invert) {
      // For price: green for cheap, red for expensive
      const ratio = item.maxVal > 0 ? item.value / item.maxVal : 0
      if (ratio < 0.3) return 'rgba(52, 211, 153, 0.8)' // green
      if (ratio < 0.6) return 'rgba(255, 225, 136, 0.7)' // gold
      return 'rgba(248, 113, 113, 0.6)' // red
    }
    return `rgba(255, 225, 136, ${0.9 - i * 0.12})`
  }

  const getBarHeight = (item) => {
    const range = (item.maxVal || 1) - (item.minVal || 0)
    if (range === 0) return 50
    const pct = ((item.value - (item.minVal || 0)) / range) * 100
    return Math.max(8, Math.min(100, item.invert ? (100 - pct + 15) : pct))
  }

  const viewLabel = VIEWS.find(v => v.id === activeView)?.label || ''

  // Summary text
  const summary = useMemo(() => {
    if (chartData.length === 0) return ''
    const top = chartData[0]
    switch (activeView) {
      case 'elo':
        return (<><span className="text-primary font-bold">{top.name}</span> leads with ELO {top.label}. Click any bar to highlight in the table.</>)
      case 'price':
        return (<><span className="text-emerald-400 font-bold">{top.name}</span> is cheapest at {top.label}/M tokens. Green bars = better value.</>)
      case 'speed':
        return (<><span className="text-primary font-bold">{top.name}</span> is fastest at {top.label}. Speed varies by provider and load.</>)
      case 'value':
        return (<><span className="text-emerald-400 font-bold">{top.name}</span> has best quality-per-dollar (score: {top.label}). Value = quality / price.</>)
      default:
        return ''
    }
  }, [chartData, activeView])

  return (
    <section data-tour="arena-insight" className="dash-card p-4 border-slate-700/50">
      {/* Header with view selector */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-white flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-lg">analytics</span>
          Arena Insight
        </h3>
      </div>

      {/* View tabs */}
      <div className="flex bg-slate-800/60 p-0.5 rounded mb-4 gap-0.5">
        {VIEWS.map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`flex-1 flex items-center justify-center gap-1 px-1 py-1.5 rounded text-[0.6rem] font-bold transition-all ${
              activeView === view.id
                ? 'bg-primary text-on-primary'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={view.label}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{view.icon}</span>
            <span className="hidden xl:inline">{view.label}</span>
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="h-32 flex items-end gap-1 mb-3">
        {chartData.map((item, i) => (
          <div
            key={item.id}
            className={`flex-1 rounded-t relative group cursor-pointer transition-all duration-300 ${
              highlightedModelId === item.id ? 'ring-2 ring-primary' : ''
            }`}
            style={{ height: `${getBarHeight(item)}%` }}
            onClick={() => onModelClick(item.id)}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-900 text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-slate-700 pointer-events-none">
              <span className="font-bold">{item.name}</span>
              <br />
              {viewLabel}: {item.label}
            </div>
            {/* Bar */}
            <div
              className="absolute bottom-0 w-full h-full rounded-t transition-all duration-500"
              style={{ background: getBarColor(item, i) }}
            />
            {/* Label below */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[7px] text-slate-500 font-bold whitespace-nowrap">
              {item.name.split(' ')[0].slice(0, 6)}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <p className="text-[0.65rem] text-slate-400 leading-relaxed font-medium mt-5">
        {summary}
      </p>
    </section>
  )
}
