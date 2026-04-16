import { useState, useMemo } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { useModelData } from '../../hooks/useModelData'
import { TASK_CATEGORIES } from '../../constants/taskCategories'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import InfoTooltip from '../../components/ui/InfoTooltip'

export default function ModelArena() {
  const { models, isLoading, error } = useModelData()
  const applyModelToCalculator = useDashboardStore(s => s.applyModelToCalculator)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const toggleCompareModel = useDashboardStore(s => s.toggleCompareModel)
  const compareModels = useDashboardStore(s => s.compareModels)

  const [activeTask, setActiveTask] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [licenseFilter, setLicenseFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredModels = useMemo(() => {
    let result = models
    if (activeTask !== 'all') {
      result = result.filter(m => m.taskStrengths?.includes(activeTask))
    }
    if (providerFilter !== 'all') {
      result = result.filter(m => m.provider === providerFilter)
    }
    if (licenseFilter !== 'all') {
      result = result.filter(m => m.license === licenseFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(m => m.name.toLowerCase().includes(q) || m.provider?.toLowerCase().includes(q))
    }
    return result
  }, [models, activeTask, providerFilter, licenseFilter, searchQuery])

  const providers = useMemo(() => [...new Set(models.map(m => m.provider).filter(Boolean))], [models])

  const handleCalculate = (model) => {
    applyModelToCalculator(model)
    setActiveTab(1)
  }

  if (isLoading && models.length === 0) return <LoadingSpinner label="Loading model data..." />

  if (error && models.length === 0) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="dash-card p-8 text-center max-w-md">
        <span className="material-symbols-outlined text-error text-4xl mb-4 block">cloud_off</span>
        <h2 className="text-lg font-bold text-white mb-2">Failed to load models</h2>
        <p className="text-sm text-slate-400 mb-4">Could not fetch model data. Using seed data as fallback.</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main Content */}
      <div className="flex-1 lg:w-3/4 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="stat-card">
            <div>
              <InfoTooltip text="Total number of LLM models tracked across all providers. Data sourced from OpenRouter and LMSYS Arena leaderboards.">
                <p className="label-micro mb-1">Total Models</p>
              </InfoTooltip>
              <h2 className="text-4xl font-black text-white tracking-tighter">{models.length}</h2>
            </div>
            <span className="material-symbols-outlined text-primary/20 text-5xl">database</span>
          </div>
          <div className="bg-dash-card p-6 rounded-lg border-l-4 border-slate-600 flex items-center justify-between shadow-lg shadow-black/20">
            <div>
              <InfoTooltip text="The highest Arena ELO score from the LMSYS Chatbot Arena. ELO ratings are based on human preference votes from blind A/B comparisons between models.">
                <p className="label-micro mb-1">Arena ELO High</p>
              </InfoTooltip>
              <h2 className="text-4xl font-black text-white tracking-tighter">{models[0]?.arenaElo || '—'}</h2>
            </div>
            <span className="material-symbols-outlined text-slate-600/20 text-5xl">leaderboard</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="dash-card p-4 sm:p-5 flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-3">
              <span className="label-micro text-primary/80">Provider</span>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                className="bg-slate-800/80 px-4 py-1.5 rounded text-xs font-medium text-slate-200 border border-slate-700 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="label-micro text-primary/80">License</span>
              <select
                value={licenseFilter}
                onChange={e => setLicenseFilter(e.target.value)}
                className="bg-slate-800/80 px-4 py-1.5 rounded text-xs font-medium text-slate-200 border border-slate-700 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="proprietary">Proprietary</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          {/* Task Segmented Control */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 pt-2 border-t border-slate-700/50">
            <span className="label-micro text-primary/80">Focus Task</span>
            <div className="flex flex-wrap bg-slate-800/60 p-1 rounded gap-0.5">
              {TASK_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTask(cat.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded text-label-sm font-bold transition-all ${
                    activeTask === cat.id
                      ? 'bg-primary text-on-primary'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs text-slate-400">
            Showing <span className="text-white font-bold">{filteredModels.length}</span> of {models.length} models
            {activeTask !== 'all' && <span className="text-primary"> — filtered by {activeTask}</span>}
          </p>
        </div>
        <div className="dash-card overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-800/40">
                  <th className="px-4 py-4 w-10 text-center">
                    <span className="text-xs text-slate-500">☐</span>
                  </th>
                  <th className="px-4 py-4 label-micro">Rank</th>
                  <th className="px-4 py-4 label-micro">Model Name</th>
                  <th className="px-4 py-4 label-micro">Provider</th>
                  <th className="px-4 py-4 label-micro text-center" title="ELO rating from LMSYS Chatbot Arena — higher is better, based on human preference votes">Arena ELO</th>
                  <th className="px-4 py-4 label-micro hidden lg:table-cell" title="Normalized quality score (0-100) derived from Arena ELO rating">Quality</th>
                  <th className="px-4 py-4 label-micro hidden md:table-cell">Context</th>
                  <th className="px-4 py-4 label-micro">$/M Tokens</th>
                  <th className="px-4 py-4 label-micro hidden md:table-cell">Speed</th>
                  <th className="px-4 py-4 label-micro text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl mb-2 block text-slate-600">search_off</span>
                      No models match the current filters. Try adjusting your criteria.
                    </td>
                  </tr>
                )}
                {filteredModels.map((model, i) => (
                  <tr key={model.id} className="hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-5 text-center">
                      <input
                        type="checkbox"
                        checked={compareModels.includes(model.id)}
                        onChange={() => toggleCompareModel(model.id)}
                        className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-6 ${i === 0 ? 'bg-primary' : 'bg-transparent'}`} />
                        <span className="text-white font-black">#{model.rank || i + 1}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-bold text-white">{model.name}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary/60 text-lg">{model.providerIcon || 'smart_toy'}</span>
                        <span className="text-xs text-slate-400">{model.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-primary font-bold">{model.arenaElo || '—'}</td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${model.qualityScore || 50}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-200 font-medium hidden md:table-cell">{model.contextLabel || '—'}</td>
                    <td className="px-4 py-4 text-xs text-slate-200">${model.inputPricePerMToken?.toFixed(2) || '—'}</td>
                    <td className="px-4 py-4 text-xs text-slate-200 hidden md:table-cell">{model.tokensPerSecond ? `${model.tokensPerSecond} tok/s` : '—'}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleCalculate(model)}
                        className="text-[0.65rem] font-black tracking-widest text-primary border border-primary/30 px-3 py-1.5 rounded hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                      >
                        CALCULATE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="lg:w-1/4 space-y-6">
        {/* Arena Insight */}
        <section className="dash-card p-4 border-slate-700/50">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">analytics</span>
            Arena Insight
          </h3>
          <div className="h-36 flex items-end gap-1.5 mb-3">
            {models.slice(0, 4).map((m, i) => {
              const maxElo = models[0]?.arenaElo || 1300
              const minElo = 1100
              const heightPct = ((m.arenaElo - minElo) / (maxElo - minElo)) * 100
              return (
                <div key={m.id} className="flex-1 bg-primary/10 rounded-t relative group" style={{ height: `${heightPct}%` }}>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-slate-700">
                    {m.name}
                  </div>
                  <div className="absolute bottom-0 w-full h-full rounded-t" style={{ background: `rgba(255, 225, 136, ${0.9 - i * 0.2})` }} />
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            <span className="text-primary font-bold">{models[0]?.name || 'Top model'}</span> leads the Arena with ELO {models[0]?.arenaElo || '—'}, followed by {models[1]?.name || 'runner-up'} at {models[1]?.arenaElo || '—'}.
          </p>
        </section>

        {/* Optimization Tip */}
        <section className="bg-gradient-to-br from-slate-800 to-dash-card p-4 rounded-lg border border-primary/20 shadow-lg shadow-black/20">
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 p-1.5 rounded shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
            </div>
            <div>
              <h4 className="text-xs font-black text-white mb-1">Optimization Tip</h4>
              <p className="text-[0.75rem] text-slate-400 mb-4 font-medium">
                {models.length > 3 && models[0]?.inputPricePerMToken > 0 && (
                  <>Switching non-critical batch processing to <span className="text-primary font-semibold">{models[3]?.name}</span> could reduce costs by up to <span className="text-white font-black">{Math.round(Math.max(0, ((models[0].inputPricePerMToken - (models[3]?.inputPricePerMToken || 0)) / models[0].inputPricePerMToken) * 100))}%</span>.</>
                )}
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
