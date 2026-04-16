import useDashboardStore from '../store/dashboardStore'
import { formatRelativeTime } from '../lib/timeUtils'
import { PROVIDERS } from '../constants/providerMetadata'

export default function HeroBanner() {
  const modelList = useDashboardStore(s => s.modelList)
  const modelsLastFetched = useDashboardStore(s => s.modelsLastFetched)

  const stats = [
    { label: 'Models Tracked', value: modelList?.length || '—', icon: 'monitoring' },
    { label: 'Providers', value: PROVIDERS.length, icon: 'dns' },
    { label: 'Last Refreshed', value: formatRelativeTime(modelsLastFetched), icon: 'update' },
  ]

  return (
    <div className="relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-primary/[0.02] pointer-events-none" />

      <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: headline */}
        <div>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
            AI Model Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time benchmarks, pricing, and infrastructure. All in one place, always current.
          </p>
        </div>

        {/* Right: live stat chips */}
        <div className="flex items-center gap-3 flex-wrap">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="flex items-center gap-2 dark:bg-slate-800/50 bg-amber-50 border dark:border-slate-700/30 border-amber-200/50 rounded-lg px-3 py-2"
            >
              <span className="material-symbols-outlined text-primary text-base">{stat.icon}</span>
              <div>
                <p className="text-[0.6rem] dark:text-slate-500 text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-xs font-bold dark:text-white text-slate-800">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </div>
  )
}
