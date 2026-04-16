import { useState } from 'react'

export default function MetricCard({ label, value, sublabel, icon, accent = false, tooltip }) {
  const [showTip, setShowTip] = useState(false)

  return (
    <div className={`bg-dash-card p-5 rounded-lg shadow-lg shadow-black/20 border ${accent ? 'border-primary/30' : 'border-slate-700/30'} relative`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-label-sm uppercase tracking-widest text-slate-400 font-bold">{label}</p>
            {tooltip && (
              <button
                onMouseEnter={() => setShowTip(true)}
                onMouseLeave={() => setShowTip(false)}
                onClick={() => setShowTip(!showTip)}
                className="text-slate-500 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xs">info</span>
              </button>
            )}
          </div>
          <h3 key={value} className="text-2xl font-black text-white tracking-tight animate-countUp">{value}</h3>
          {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
        </div>
        {icon && (
          <span className="material-symbols-outlined text-primary/20 text-3xl">{icon}</span>
        )}
      </div>
      {showTip && tooltip && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 shadow-xl z-50 leading-relaxed">
          {tooltip}
        </div>
      )}
    </div>
  )
}
