export default function MetricCard({ label, value, sublabel, icon, accent = false }) {
  return (
    <div className={`bg-dash-card p-5 rounded-lg shadow-lg shadow-black/20 border ${accent ? 'border-primary/30' : 'border-slate-700/30'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-label-sm uppercase tracking-widest text-slate-400 font-bold mb-1">{label}</p>
          <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
          {sublabel && <p className="text-xs text-slate-500 mt-1">{sublabel}</p>}
        </div>
        {icon && (
          <span className="material-symbols-outlined text-primary/20 text-3xl">{icon}</span>
        )}
      </div>
    </div>
  )
}
