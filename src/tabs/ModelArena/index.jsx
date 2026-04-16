import { useState, useMemo, useCallback } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { useModelData } from '../../hooks/useModelData'
import { TASK_CATEGORIES } from '../../constants/taskCategories'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import InfoTooltip from '../../components/ui/InfoTooltip'
import ArenaInsight from './ArenaInsight'
import ModelCompareDrawer from './ModelCompareDrawer'

// Value score: quality per dollar (higher = better value)
function computeValueScore(model) {
  const price = model.inputPricePerMToken || 0
  if (price <= 0) return 100
  const quality = model.qualityScore || 50
  return Math.round((quality / price) * 10)
}

function getValueColor(score) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 40) return 'text-primary'
  if (score >= 20) return 'text-amber-400'
  return 'text-red-400'
}

function getValueLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 40) return 'Good'
  if (score >= 20) return 'Fair'
  return 'Low'
}

export default function ModelArena() {
  const { models, isLoading, error } = useModelData()
  const applyModelToCalculator = useDashboardStore(s => s.applyModelToCalculator)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const toggleCompareModel = useDashboardStore(s => s.toggleCompareModel)
  const compareModels = useDashboardStore(s => s.compareModels)
  const clearCompareModels = useDashboardStore(s => s.clearCompareModels)

  const [activeTask, setActiveTask] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [licenseFilter, setLicenseFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedModelId, setHighlightedModelId] = useState(null)
  const [showCompare, setShowCompare] = useState(false)

  // Add value scores to models
  const modelsWithValue = useMemo(() =>
    models.map(m => ({ ...m, valueScore: computeValueScore(m) })),
    [models]
  )

  const filteredModels = useMemo(() => {
    let result = modelsWithValue
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
  }, [modelsWithValue, activeTask, providerFilter, licenseFilter, searchQuery])

  const providers = useMemo(() => [...new Set(models.map(m => m.provider).filter(Boolean))], [models])

  const handleCalculate = useCallback((model) => {
    applyModelToCalculator(model)
    setActiveTab(1)
  }, [applyModelToCalculator, setActiveTab])

  // Get full model objects for comparison
  const comparedModels = useMemo(() =>
    compareModels.map(id => modelsWithValue.find(m => m.id === id)).filter(Boolean),
    [compareModels, modelsWithValue]
  )

  if (isLoading && models.length === 0) {
    return (
      <div className="flex flex-col lg:flex-row gap-8 animate-pulse">
        <div className="flex-1 lg:w-3/4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="h-28 bg-dash-card rounded-lg" />
            <div className="h-28 bg-dash-card rounded-lg" />
          </div>
          <div className="h-20 bg-dash-card rounded-lg" />
          <div className="h-96 bg-dash-card rounded-lg" />
        </div>
        <div className="lg:w-1/4 space-y-6">
          <div className="h-56 bg-dash-card rounded-lg" />
          <div className="h-32 bg-dash-card rounded-lg" />
        </div>
      </div>
    )
  }

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
      <div className="flex-1 lg:w-3/4 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-staggerIn">
          <div className="stat-card">
            <div>
              <InfoTooltip text="Total number of LLM models tracked across all providers.">
                <p className="label-micro mb-1">Total Models</p>
              </InfoTooltip>
              <h2 className="text-3xl font-black text-white tracking-tighter">{models.length}</h2>
            </div>
            <span className="material-symbols-outlined text-primary/20 text-4xl">database</span>
          </div>
          <div className="bg-dash-card p-5 rounded-lg border-l-4 border-slate-600 flex items-center justify-between shadow-lg shadow-black/20">
            <div>
              <InfoTooltip text="Highest Arena ELO from LMSYS Chatbot Arena. Based on human blind A/B comparisons.">
                <p className="label-micro mb-1">Arena ELO High</p>
              </InfoTooltip>
              <h2 className="text-3xl font-black text-white tracking-tighter">{models[0]?.arenaElo || '—'}</h2>
            </div>
            <span className="material-symbols-outlined text-slate-600/20 text-4xl">leaderboard</span>
          </div>
          <div className="bg-dash-card p-5 rounded-lg border-l-4 border-emerald-600/50 flex items-center justify-between shadow-lg shadow-black/20">
            <div>
              <InfoTooltip text="Best value model: highest quality-to-price ratio. Score = (qualityScore / pricePerMTokens) * 10">
                <p className="label-micro mb-1">Best Value</p>
              </InfoTooltip>
              <h2 className="text-lg font-black text-emerald-400 tracking-tight">
                {[...modelsWithValue].sort((a, b) => b.valueScore - a.valueScore)[0]?.name || '—'}
              </h2>
            </div>
            <span className="material-symbols-outlined text-emerald-600/20 text-4xl">thumb_up</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="dash-card p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <div className="flex items-center gap-2">
              <span className="label-micro text-primary/80">Provider</span>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value)}
                className="bg-slate-800/80 px-3 py-1.5 rounded text-xs font-medium text-slate-200 border border-slate-700 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                {providers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="label-micro text-primary/80">License</span>
              <select
                value={licenseFilter}
                onChange={e => setLicenseFilter(e.target.value)}
                className="bg-slate-800/80 px-3 py-1.5 rounded text-xs font-medium text-slate-200 border border-slate-700 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="proprietary">Proprietary</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-4 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-700/50">
            <span className="label-micro text-primary/80">Focus Task</span>
            <div className="flex flex-wrap bg-slate-800/60 p-1 rounded gap-0.5">
              {TASK_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTask(cat.id)}
                  className={`px-3 py-1.5 rounded text-label-sm font-bold transition-all ${
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

        {/* Table Header */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">
            Showing <span className="text-white font-bold">{filteredModels.length}</span> of {models.length} models
            {activeTask !== 'all' && <span className="text-primary"> — filtered by {activeTask}</span>}
          </p>
          {compareModels.length >= 2 && (
            <button
              onClick={() => setShowCompare(true)}
              className="text-[0.65rem] font-black tracking-widest text-on-primary bg-primary px-3 py-1.5 rounded hover:opacity-90 transition-all flex items-center gap-1.5 animate-pulse"
            >
              <span className="material-symbols-outlined text-sm">compare</span>
              COMPARE {compareModels.length} MODELS
            </button>
          )}
        </div>

        {/* Main Table */}
        <div className="dash-card overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-800/40">
                  <th className="px-3 py-3 w-10 text-center">
                    <span className="text-xs text-slate-500">☐</span>
                  </th>
                  <th className="px-3 py-3 label-micro">Rank</th>
                  <th className="px-3 py-3 label-micro">Model Name</th>
                  <th className="px-3 py-3 label-micro">Provider</th>
                  <th className="px-3 py-3 label-micro text-center" title="ELO rating from LMSYS Chatbot Arena">Arena ELO</th>
                  <th className="px-3 py-3 label-micro hidden lg:table-cell" title="Normalized quality score (0-100)">Quality</th>
                  <th className="px-3 py-3 label-micro" title="Value = quality / price. Higher is better bang-for-buck">Value</th>
                  <th className="px-3 py-3 label-micro hidden md:table-cell">Context</th>
                  <th className="px-3 py-3 label-micro">$/M</th>
                  <th className="px-3 py-3 label-micro hidden md:table-cell">Speed</th>
                  <th className="px-3 py-3 label-micro text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl mb-2 block text-slate-600">search_off</span>
                      No models match the current filters. Try adjusting your criteria.
                    </td>
                  </tr>
                )}
                {filteredModels.map((model, i) => (
                  <tr
                    key={model.id}
                    className={`transition-all duration-200 cursor-pointer ${
                      highlightedModelId === model.id
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-slate-800/50'
                    }`}
                    onClick={() => setHighlightedModelId(highlightedModelId === model.id ? null : model.id)}
                  >
                    <td className="px-3 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={compareModels.includes(model.id)}
                        onChange={() => toggleCompareModel(model.id)}
                        className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-5 rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-primary/60' : i === 2 ? 'bg-primary/30' : 'bg-transparent'}`} />
                        <span className="text-white font-black text-sm">#{model.rank || i + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-bold text-white text-sm">{model.name}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary/60 text-base">{model.providerIcon || 'smart_toy'}</span>
                        <span className="text-xs text-slate-400">{model.provider}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono text-primary font-bold text-sm">{model.arenaElo || '—'}</td>
                    <td className="px-3 py-3.5 hidden lg:table-cell">
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${model.qualityScore || 50}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`text-xs font-black ${getValueColor(model.valueScore)}`} title={`Value score: ${model.valueScore}`}>
                        {getValueLabel(model.valueScore)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-200 font-medium hidden md:table-cell">{model.contextLabel || '—'}</td>
                    <td className="px-3 py-3.5 text-xs text-slate-200">${model.inputPricePerMToken?.toFixed(2) || '—'}</td>
                    <td className="px-3 py-3.5 text-xs text-slate-200 hidden md:table-cell">{model.tokensPerSecond ? `${model.tokensPerSecond}` : '—'}</td>
                    <td className="px-3 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleCalculate(model)}
                        className="text-[0.6rem] font-black tracking-widest text-primary border border-primary/30 px-2.5 py-1.5 rounded hover:bg-primary hover:text-on-primary transition-all active:scale-95"
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

      {/* Right Sidebar — Interactive Arena Insight */}
      <aside className="lg:w-1/4 space-y-5">
        <ArenaInsight
          models={modelsWithValue}
          filteredModels={filteredModels}
          highlightedModelId={highlightedModelId}
          onModelClick={(id) => setHighlightedModelId(highlightedModelId === id ? null : id)}
        />

        {/* Optimization Tip */}
        <section className="bg-gradient-to-br from-slate-800 to-dash-card p-4 rounded-lg border border-primary/20 shadow-lg shadow-black/20">
          <div className="flex items-start gap-3">
            <div className="bg-primary/20 p-1.5 rounded shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
            </div>
            <div>
              <h4 className="text-xs font-black text-white mb-1">Optimization Tip</h4>
              <p className="text-[0.7rem] text-slate-400 font-medium leading-relaxed">
                {(() => {
                  const bestValue = [...modelsWithValue].sort((a, b) => b.valueScore - a.valueScore)[0]
                  const topModel = models[0]
                  if (!bestValue || !topModel || bestValue.id === topModel.id) return 'Select different models to see optimization tips.'
                  const savings = topModel.inputPricePerMToken > 0
                    ? Math.round(((topModel.inputPricePerMToken - bestValue.inputPricePerMToken) / topModel.inputPricePerMToken) * 100)
                    : 0
                  if (savings <= 0) return `${topModel.name} is already the most cost-effective option.`
                  return (<>Switch from <span className="text-white font-semibold">{topModel.name}</span> to <span className="text-primary font-semibold">{bestValue.name}</span> for <span className="text-emerald-400 font-black">{savings}%</span> cost savings with {bestValue.qualityScore >= topModel.qualityScore * 0.85 ? 'comparable' : 'some'} quality.</>)
                })()}
              </p>
            </div>
          </div>
        </section>
      </aside>

      {/* Model Compare Drawer */}
      {showCompare && comparedModels.length >= 2 && (
        <ModelCompareDrawer
          models={comparedModels}
          onClose={() => setShowCompare(false)}
          onClearAll={() => { clearCompareModels(); setShowCompare(false) }}
        />
      )}
    </div>
  )
}
