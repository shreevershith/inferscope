import { useState } from 'react'

/**
 * MetricCard
 *
 * Props:
 * - label: string. The metric name.
 * - value: string | number. The big headline value.
 * - sublabel?: string. Small text below the value.
 * - icon?: string. Material Symbols icon name (decorative).
 * - accent?: boolean. Highlight with primary border.
 * - hero?: boolean. Fill with primary; use as the visual "headline" of a group.
 * - tooltip?: string. Info tooltip content.
 * - trend?: { value: string, direction: 'up' | 'down' | 'flat' }. Delta chip.
 * - source?: string. Small source tag shown bottom-left.
 */
export default function MetricCard({ label, value, sublabel, icon, accent = false, hero = false, tooltip, trend, source }) {
  const [showTip, setShowTip] = useState(false)

  const containerClass = hero
    ? 'bg-primary dark:bg-primary p-5 rounded-lg shadow-lg shadow-black/20 relative overflow-hidden'
    : `dark:bg-dash-card bg-white p-5 rounded-lg shadow-lg dark:shadow-black/20 shadow-slate-200/50 border ${accent ? 'border-primary/30' : 'dark:border-slate-700/30 border-slate-200'} relative ${showTip ? 'z-10' : ''}`

  const labelColor = hero ? 'text-on-primary/70' : 'dark:text-slate-400 text-slate-500'
  const valueColor = hero ? 'text-on-primary' : 'dark:text-white text-slate-800'
  const subColor = hero ? 'text-on-primary/60' : 'dark:text-slate-500 text-slate-500'
  const iconColor = hero ? 'text-on-primary/30' : 'text-primary/50'
  const tipBtnColor = hero ? 'text-on-primary/50 hover:text-on-primary' : 'text-slate-500 hover:text-primary'

  const trendColor = trend?.direction === 'up'
    ? 'text-emerald-400'
    : trend?.direction === 'down'
      ? 'text-rose-400'
      : 'text-slate-400'
  const trendIcon = trend?.direction === 'up' ? 'trending_up' : trend?.direction === 'down' ? 'trending_down' : 'trending_flat'

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <p className={`text-label-sm uppercase tracking-widest font-bold ${labelColor}`}>{label}</p>
            {tooltip && (
              <button
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
                onClick={() => setShowTip(!showTip)}
                className={`transition-colors ${tipBtnColor}`}
                aria-label="More information"
              >
                <span className="material-symbols-outlined text-xs">info</span>
              </button>
            )}
          </div>
          <h3 key={value} className={`text-2xl font-black tracking-tight animate-countUp ${valueColor}`}>{value}</h3>
          {sublabel && <p className={`text-xs mt-1 ${subColor}`}>{sublabel}</p>}
        </div>
        {icon && (
          <span className={`material-symbols-outlined text-3xl ${iconColor}`}>{icon}</span>
        )}
      </div>

      {(trend || source) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t dark:border-slate-700/30 border-slate-200/70">
          {trend && (
            <span className={`inline-flex items-center gap-1 text-[0.65rem] font-bold ${hero ? 'text-on-primary/80' : trendColor}`}>
              <span className="material-symbols-outlined text-xs">{trendIcon}</span>
              {trend.value}
            </span>
          )}
          {source && (
            <span className={`text-[0.55rem] uppercase tracking-wider font-bold ${hero ? 'text-on-primary/60' : 'dark:text-slate-500 text-slate-400'}`}>
              {source}
            </span>
          )}
        </div>
      )}

      {showTip && tooltip && (
        <div className="absolute top-full left-4 right-4 mt-2 dark:bg-slate-900 bg-white dark:border-slate-700 border-slate-200 border rounded-lg px-3 py-2 text-xs dark:text-slate-300 text-slate-600 shadow-xl z-50 leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  )
}
