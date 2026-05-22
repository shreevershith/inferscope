import { useState, useEffect, useCallback, useMemo } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { useCostCalculator } from '../../hooks/useCostCalculator'
import MetricCard from '../../components/ui/MetricCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Line, CartesianGrid, ReferenceLine } from 'recharts'
import { SCENARIO_MULTIPLIERS } from '../../constants/taskCategories'
import { formatRelativeTime } from '../../lib/timeUtils'
import { suggestDefaults } from '../../lib/smartDefaults'
import { recommendForWorkload } from '../../lib/workloadRecommender'
import { events } from '../../lib/telemetry'

const fmt = (n) => {
  if (typeof n !== 'number' || !isFinite(n)) return '$—'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${Math.max(0, n).toFixed(2)}`
}

// Hoisted Recharts constants: prevent re-render churn
const CHART_TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }
const formatDollarTick = v => `$${v.toFixed(0)}`
const formatCompactDollarTick = v => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)}`
const formatBreakdownTooltip = (v, name) => [`$${v.toFixed(2)}`, name]

/* Custom tooltip for the Cost vs Volume chart.
   Shows selected model + comparison model costs at each volume point. */
function VolumeChartTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2.5 shadow-xl min-w-[160px] dark:bg-slate-800 bg-white dark:border-slate-700 border-slate-200 border rounded-lg text-xs">
      <p className="dark:text-white text-slate-800 font-bold text-[0.7rem] mb-2">{d.label} req/day</p>
      <div className="space-y-1.5 text-[0.65rem]">
        <div className="flex justify-between gap-6">
          <span className="text-primary font-bold">Selected Model</span>
          <span className="text-primary font-bold">{fmt(d.monthlyCost)}</span>
        </div>
        {d.comp0Name != null && (
          <div className="flex justify-between gap-4">
            <span className="text-cyan-600 dark:text-cyan-400 truncate max-w-[110px]" title={d.comp0Name}>{d.comp0Name}</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold">{fmt(d.comp0)}</span>
          </div>
        )}
        {d.comp1Name != null && (
          <div className="flex justify-between gap-4">
            <span className="text-violet-600 dark:text-violet-400 truncate max-w-[110px]" title={d.comp1Name}>{d.comp1Name}</span>
            <span className="text-violet-600 dark:text-violet-400 font-bold">{fmt(d.comp1)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
// Log-scale x-axis: domain + ticks are derived adaptively from the user's
// current requestsPerDay (see getAdaptiveVolumeTicks). Each render computes
// them from the same sweep used to build `volumeCurve` so labels never desync.
const formatVolumeTick = v => v >= 1_000_000
  ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1000
    ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`
    : v.toString()

const TOKEN_INPUTS = [
  { key: 'inputTokens', label: 'Input Tokens / Req', icon: 'input' },
  { key: 'outputTokens', label: 'Output Tokens / Req', icon: 'output' },
  { key: 'requestsPerDay', label: 'Daily Requests', icon: 'speed' },
]

export default function CostCalculator() {
  const inputs = useDashboardStore(s => s.calculatorInputs)
  const setInputs = useDashboardStore(s => s.setCalculatorInputs)
  const modelList = useDashboardStore(s => s.modelList)
  const modelsLastFetched = useDashboardStore(s => s.modelsLastFetched)
  const { costs, volumeCurve } = useCostCalculator()

  // Local state for token input fields: debounced into the store to avoid 12x recalc per keystroke
  const [localTokens, setLocalTokens] = useState({
    inputTokens: inputs.inputTokens,
    outputTokens: inputs.outputTokens,
    requestsPerDay: inputs.requestsPerDay,
  })

  // Sync local from store (e.g., when "Calculate" button preloads a model from another tab)
  useEffect(() => {
    setLocalTokens({
      inputTokens: inputs.inputTokens,
      outputTokens: inputs.outputTokens,
      requestsPerDay: inputs.requestsPerDay,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.inputTokens, inputs.outputTokens, inputs.requestsPerDay])

  // Auto-select the top-ranked priced model once data lands, so the calculator
  // shows real numbers immediately instead of $0 everywhere. Skip variable-
  // priced router models (no fixed cost to project from).
  useEffect(() => {
    if (inputs.selectedModelId) return
    if (!modelList || modelList.length === 0) return
    const firstPriced = modelList.find(m =>
      !m.isVariablePrice &&
      Number.isFinite(m.inputPricePerMToken) &&
      m.inputPricePerMToken > 0
    )
    if (!firstPriced) return
    setInputs({
      selectedModelId: firstPriced.id,
      selectedModelName: firstPriced.name,
      inputPricePerMToken: firstPriced.inputPricePerMToken,
      outputPricePerMToken: firstPriced.outputPricePerMToken || 0,
      cachedInputPrice: firstPriced.cachedInputPrice ?? firstPriced.inputPricePerMToken * 0.1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelList, inputs.selectedModelId])

  // Debounce local token edits → store (300ms)
  useEffect(() => {
    const id = setTimeout(() => {
      const updates = {}
      if (localTokens.inputTokens !== inputs.inputTokens) updates.inputTokens = localTokens.inputTokens
      if (localTokens.outputTokens !== inputs.outputTokens) updates.outputTokens = localTokens.outputTokens
      if (localTokens.requestsPerDay !== inputs.requestsPerDay) updates.requestsPerDay = localTokens.requestsPerDay
      if (Object.keys(updates).length > 0) setInputs(updates)
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localTokens, setInputs])

  const handleTokenInput = useCallback((key, value) => {
    const num = Math.max(0, parseFloat(value) || 0)
    setLocalTokens(prev => ({ ...prev, [key]: num }))
  }, [])

  const handleSliderInput = useCallback((value) => {
    setInputs({ cachingHitRate: parseFloat(value) || 0 })
  }, [setInputs])

  const handleModelChange = useCallback((e) => {
    const model = modelList.find(m => m.id === e.target.value)
    if (model) {
      setInputs({
        selectedModelId: model.id,
        selectedModelName: model.name,
        inputPricePerMToken: model.inputPricePerMToken,
        outputPricePerMToken: model.outputPricePerMToken,
        cachedInputPrice: model.cachedInputPrice ?? model.inputPricePerMToken * 0.1,
      })
    }
  }, [modelList, setInputs])

  const breakdownData = useMemo(() => [{ name: 'Cost', ...costs.breakdown }], [costs.breakdown])

  // Domain + ticks for the Cost-vs-Volume chart: adapt to the actual sweep so
  // the user's input sits near the middle of the curve regardless of scale.
  const volumeAxis = useMemo(() => {
    if (!volumeCurve || volumeCurve.length === 0) {
      return { ticks: [10, 100, 1000], domain: [8, 1200] }
    }
    const ticks = volumeCurve.map(v => v.requestsPerDay)
    const min = Math.max(1, ticks[0] * 0.8)
    const max = ticks[ticks.length - 1] * 1.3
    return { ticks, domain: [min, max] }
  }, [volumeCurve])

  // Comparison models for the volume chart: show how the selected model's cost
  // scales vs alternatives. Picks cheapest-quality and best-quality-cheaper.
  const comparisonModels = useMemo(() => {
    if (!modelList?.length || !inputs.selectedModelId) return []
    const selected = modelList.find(m => m.id === inputs.selectedModelId)
    if (!selected || !selected.inputPricePerMToken) return []
    const selectedTotal = (selected.inputPricePerMToken || 0) + (selected.outputPricePerMToken || 0)

    const candidates = modelList.filter(m =>
      m.id !== selected.id &&
      !m.isVariablePrice &&
      m.inputPricePerMToken != null &&
      m.inputPricePerMToken > 0 &&
      (m.qualityScore || 0) >= 50
    )
    if (candidates.length === 0) return []

    // Cheapest model with quality > 50
    const cheapest = [...candidates]
      .sort((a, b) =>
        (a.inputPricePerMToken + (a.outputPricePerMToken || 0)) -
        (b.inputPricePerMToken + (b.outputPricePerMToken || 0))
      )[0]

    // Highest quality model that's cheaper than selected
    const betterDeal = [...candidates]
      .filter(m => (m.inputPricePerMToken + (m.outputPricePerMToken || 0)) < selectedTotal)
      .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))[0]

    const result = []
    if (cheapest) result.push(cheapest)
    if (betterDeal && betterDeal.id !== cheapest?.id) result.push(betterDeal)
    return result.slice(0, 2)
  }, [modelList, inputs.selectedModelId])

  // Cost ratio between comparison models and selected model, used to scale
  // the base volume curve proportionally for overlay lines.
  const compRatios = useMemo(() => {
    const selPerReq = ((inputs.inputTokens || 0) / 1e6) * (inputs.inputPricePerMToken || 0)
      + ((inputs.outputTokens || 0) / 1e6) * (inputs.outputPricePerMToken || 0)
    return comparisonModels.map(cm => {
      const cmPerReq = ((inputs.inputTokens || 0) / 1e6) * (cm.inputPricePerMToken || 0)
        + ((inputs.outputTokens || 0) / 1e6) * (cm.outputPricePerMToken || 0)
      return selPerReq > 0 ? cmPerReq / selPerReq : 0
    })
  }, [inputs.inputTokens, inputs.outputTokens, inputs.inputPricePerMToken, inputs.outputPricePerMToken, comparisonModels])

  // Volume data with comparison model overlay lines.
  const volumeBandData = useMemo(() => {
    if (!volumeCurve?.length) return []
    return volumeCurve.map(point => {
      const d = { ...point }
      // Overlay comparison model costs scaled by ratio
      comparisonModels.forEach((cm, i) => {
        d[`comp${i}`] = point.monthlyCost * compRatios[i]
        d[`comp${i}Name`] = cm.name
      })
      return d
    })
  }, [volumeCurve, comparisonModels, compRatios])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <p className="label-micro mb-1">AI Analysis</p>
          <h2 className="text-xl sm:text-headline-sm font-black text-white">Cost Projection Engine</h2>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-livePulse" />
          <span className="material-symbols-outlined text-sm">schedule</span>
          Last updated: {formatRelativeTime(modelsLastFetched)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div data-tour="calc-inputs" className="dash-card p-6 space-y-5">
          <h3 className="text-title-md font-black text-white">Estimate Your Costs</h3>

          {/* Model Selector */}
          <div>
            <label className="label-micro text-primary/80 block mb-2">Inference Model</label>
            <select
              value={inputs.selectedModelId || ''}
              onChange={handleModelChange}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a model</option>
              {modelList.map(m => {
                const isVariable = m.isVariablePrice || m.inputPricePerMToken == null
                const label = isVariable
                  ? 'Variable — no fixed price'
                  : m.inputPricePerMToken > 0
                    ? `$${m.inputPricePerMToken.toFixed(2)}/M`
                    : 'Free'
                return (
                  <option key={m.id} value={m.id} disabled={isVariable}>
                    {m.name} · {label}
                  </option>
                )
              })}
            </select>
            {(() => {
              const selected = modelList.find(m => m.id === inputs.selectedModelId)
              const suggestion = suggestDefaults(selected)
              if (!suggestion) return null
              const matches =
                inputs.inputTokens === suggestion.inputTokens &&
                inputs.outputTokens === suggestion.outputTokens &&
                inputs.requestsPerDay === suggestion.requestsPerDay
              if (matches) return null
              return (
                <button
                  type="button"
                  onClick={() => {
                    setInputs({
                      inputTokens: suggestion.inputTokens,
                      outputTokens: suggestion.outputTokens,
                      requestsPerDay: suggestion.requestsPerDay,
                    })
                    setLocalTokens({
                      inputTokens: suggestion.inputTokens,
                      outputTokens: suggestion.outputTokens,
                      requestsPerDay: suggestion.requestsPerDay,
                    })
                  }}
                  className="mt-2 w-full flex items-center justify-between gap-2 text-[0.65rem] text-slate-400 hover:text-primary px-3 py-1.5 rounded border border-slate-700/40 hover:border-primary/40 transition-all"
                  title={suggestion.rationale}
                >
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                    Use {suggestion.label} defaults
                  </span>
                  <span className="font-mono">{suggestion.inputTokens} / {suggestion.outputTokens} tok · {suggestion.requestsPerDay}/d</span>
                </button>
              )
            })()}
          </div>

          {/* Token Inputs (debounced) */}
          {TOKEN_INPUTS.map(({ key, label, icon }) => (
            <div key={key}>
              <label className="label-micro text-primary/80 block mb-2">{label}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{icon}</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  value={localTokens[key]}
                  onChange={e => handleTokenInput(key, e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          ))}

          {/* Caching Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="label-micro text-primary/80">Cache Hit Rate</label>
              <span className="text-xs font-medium text-slate-200">{inputs.cachingHitRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={inputs.cachingHitRate}
              onChange={e => handleSliderInput(e.target.value)}
              className="w-full h-1.5 dark:bg-slate-600 bg-slate-300 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,225,136,0.4)] [&::-webkit-slider-thumb]:cursor-pointer accent-primary"
            />
          </div>

          {/* Scenario Toggle + custom multiplier editor */}
          <div>
            <label className="label-micro text-primary/80 block mb-2">Traffic Profile</label>
            <div className="flex bg-slate-800/60 p-1 rounded">
              {Object.entries(SCENARIO_MULTIPLIERS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => { setInputs({ scenario: key }); events.calculatorScenario(key) }}
                  className={`flex-1 px-2 py-2 rounded text-label-sm font-bold transition-all ${
                    inputs.scenario === key
                      ? 'bg-primary text-on-primary'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(() => {
              const key = inputs.scenario
              const cfg = SCENARIO_MULTIPLIERS[key]
              if (!cfg) return null
              const override = inputs.scenarioOverrides?.[key]
              const effective = Number.isFinite(override) ? override : cfg.requestMultiplier
              return (
                <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-slate-500">
                  <span className="text-slate-400">{cfg.hint}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <span>×</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="100"
                      value={effective}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!Number.isFinite(v) || v < 0) return
                        setInputs({
                          scenarioOverrides: { ...(inputs.scenarioOverrides || {}), [key]: v },
                        })
                      }}
                      className="w-14 bg-slate-800/80 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono text-right outline-none focus:ring-1 focus:ring-primary"
                      title="Multiplier — edit to customize"
                    />
                    {Number.isFinite(override) && override !== cfg.requestMultiplier && (
                      <button
                        onClick={() => {
                          const next = { ...(inputs.scenarioOverrides || {}) }
                          delete next[key]
                          setInputs({ scenarioOverrides: next })
                        }}
                        className="text-slate-500 hover:text-primary"
                        title={`Reset to default ${cfg.requestMultiplier}×`}
                      >
                        <span className="material-symbols-outlined text-xs">refresh</span>
                      </button>
                    )}
                  </span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Output Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div data-tour="calc-metrics" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              accent
              label="Estimated Monthly Cost"
              value={fmt(costs.monthlyCost)}
              sublabel={`Reflecting current ${inputs.selectedModelName || 'model'} pricing`}
              icon="payments"
              tooltip="Total monthly cost = (input tokens + output tokens) x price per token x requests per day x 30 days, minus caching savings."
              source="Live · OpenRouter"
            />
            <MetricCard
              label="Average Cost / Request"
              value={`$${costs.costPerRequest.toFixed(4)}`}
              sublabel={costs.costPerRequest < 0.01 ? 'Efficiency: HIGH' : 'Efficiency: MODERATE'}
              icon="speed"
              tooltip="Monthly cost divided by total requests. Below $0.01/req is considered highly cost-efficient."
              trend={costs.costPerRequest < 0.01 ? { value: 'Efficient', direction: 'up' } : { value: 'Moderate', direction: 'flat' }}
            />
            <MetricCard
              label="Annual Expenditure"
              value={fmt(costs.annualCost)}
              sublabel="Projected based on current traffic pattern"
              icon="calendar_month"
              tooltip="Monthly cost x 12. Actual costs may vary with pricing changes and traffic fluctuations."
              source="12-month projection"
            />
            <MetricCard
              label="Cached Monthly Savings"
              value={fmt(costs.cacheSavings)}
              sublabel={`${inputs.cachingHitRate}% volume offset`}
              icon="savings"
              accent
              tooltip="Amount saved by caching repeated input tokens. Cached tokens cost ~90% less. Increase cache hit rate to maximize savings."
              trend={costs.cacheSavings > 0 ? { value: `${inputs.cachingHitRate}% hit rate`, direction: 'up' } : null}
            />
          </div>

          {/* Blended cost + token ratio insights */}
          {costs.monthlyCost > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs dark:bg-slate-800/30 bg-slate-100 rounded-lg px-4 py-2.5">
              <span className="flex items-center gap-1.5 dark:text-slate-400 text-slate-600">
                <span className="material-symbols-outlined text-sm text-primary/60">avg_pace</span>
                Blended
                <span className="dark:text-white text-slate-900 font-bold">${costs.blendedPerMToken.toFixed(2)}/M tok</span>
              </span>
              <span className="flex items-center gap-1.5 dark:text-slate-400 text-slate-600">
                <span className="material-symbols-outlined text-sm text-primary/60">compare_arrows</span>
                I/O Ratio
                <span className="dark:text-white text-slate-900 font-bold">
                  {inputs.inputTokens}:{inputs.outputTokens}
                </span>
              </span>
              <span className="dark:text-slate-500 text-slate-500 text-[0.65rem] ml-auto">
                {(() => {
                  const ratio = (inputs.outputTokens || 0) / Math.max(1, inputs.inputTokens || 1)
                  if (ratio > 3) return 'Output-heavy — prioritize cheap output pricing'
                  if (ratio < 0.3) return 'Input-heavy — caching has highest cost impact'
                  return 'Balanced I/O — caching and output pricing both matter'
                })()}
              </span>
            </div>
          )}

          {/* Charts */}
          <div data-tour="calc-charts" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <div className="dash-card p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h4 className="label-micro">Monthly Cost Distribution</h4>
                <p className="text-[0.6rem] text-slate-500 uppercase tracking-wider">Source: Live Pricing</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={breakdownData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} className="dark:[&_text]:fill-slate-400 [&_text]:fill-slate-500" tickFormatter={formatDollarTick} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={formatBreakdownTooltip} cursor={{ fill: 'rgba(255,225,136,0.08)' }} />
                  <Bar dataKey="inputCost" name="Input Cost" stackId="a" fill="#ffe188" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="outputCost" name="Output Cost" stackId="a" fill="#d4a500" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#ffe188]" />
                    <span className="dark:text-slate-400 text-slate-600">Input{costs.monthlyCost > 0 ? ` (${Math.round(costs.breakdown.inputCost / costs.monthlyCost * 100)}%)` : ''}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#d4a500]" />
                    <span className="dark:text-slate-400 text-slate-600">Output{costs.monthlyCost > 0 ? ` (${Math.round(costs.breakdown.outputCost / costs.monthlyCost * 100)}%)` : ''}</span>
                  </span>
                </div>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(costs.cacheSavings)} saved</span>
              </div>
            </div>

            {/* Cost vs Volume — selected model + comparison lines */}
            <div className="dash-card p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h4 className="label-micro">Cost vs Volume</h4>
                <p className="text-[0.6rem] text-slate-500 uppercase tracking-wider">
                  Log scale{comparisonModels.length > 0 ? ` · ${comparisonModels.length + 1} models` : ''}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={volumeBandData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700 stroke-slate-200" />
                  <XAxis
                    type="number"
                    dataKey="requestsPerDay"
                    scale="log"
                    domain={volumeAxis.domain}
                    ticks={volumeAxis.ticks}
                    tick={{ fontSize: 10 }}
                    className="dark:[&_text]:fill-slate-400 [&_text]:fill-slate-500"
                    tickFormatter={formatVolumeTick}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    className="dark:[&_text]:fill-slate-400 [&_text]:fill-slate-500"
                    tickFormatter={formatCompactDollarTick}
                    domain={[0, 'dataMax']}
                    padding={{ top: 10 }}
                  />
                  <Tooltip
                    content={<VolumeChartTooltip />}
                    cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }}
                  />
                  {/* Selected model (solid gold) */}
                  <Line type="monotone" dataKey="monthlyCost" stroke="#ffe188" strokeWidth={2.5} dot={{ fill: '#ffe188', r: 3, strokeWidth: 0 }} name="Selected" />
                  {/* Comparison model lines */}
                  {comparisonModels.length > 0 && (
                    <Line type="monotone" dataKey="comp0" stroke="#22d3ee" strokeWidth={2} dot={false} name={comparisonModels[0]?.name} />
                  )}
                  {comparisonModels.length > 1 && (
                    <Line type="monotone" dataKey="comp1" stroke="#a78bfa" strokeWidth={2} dot={false} name={comparisonModels[1]?.name} />
                  )}
                  {/* Reference line at user's current volume */}
                  <ReferenceLine x={inputs.requestsPerDay} stroke="#ffe188" strokeDasharray="3 3" strokeOpacity={0.4} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-0.5 rounded bg-primary" />
                  <span className="dark:text-slate-400 text-slate-600">{inputs.selectedModelName || 'Selected'}</span>
                </span>
                {comparisonModels[0] && (
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-0.5 rounded bg-cyan-400" />
                    <span className="dark:text-slate-400 text-slate-600 truncate max-w-[100px]" title={comparisonModels[0].name}>{comparisonModels[0].name}</span>
                  </span>
                )}
                {comparisonModels[1] && (
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-0.5 rounded bg-violet-400" />
                    <span className="dark:text-slate-400 text-slate-600 truncate max-w-[100px]" title={comparisonModels[1].name}>{comparisonModels[1].name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Workload-aware recommendations — derived from the same inputs that
              drive the cost charts, so the suggestions update in real time. */}
          <WorkloadRecommendations
            modelList={modelList}
            calculatorInputs={inputs}
            scenarioMultiplier={
              Number.isFinite(inputs.scenarioOverrides?.[inputs.scenario])
                ? inputs.scenarioOverrides[inputs.scenario]
                : (SCENARIO_MULTIPLIERS[inputs.scenario]?.requestMultiplier ?? 1)
            }
            onPickModel={(m) => {
              setInputs({
                selectedModelId: m.id,
                selectedModelName: m.name,
                inputPricePerMToken: m.inputPricePerMToken,
                outputPricePerMToken: m.outputPricePerMToken,
                cachedInputPrice: m.cachedInputPrice ?? m.inputPricePerMToken * 0.1,
              })
              events.modelSelect(m.id, m.name, 'workload_recommendation')
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Workload Recommendations — 3 best models for the current calculator
// inputs, with reasoning. Lets users click to apply the model directly.
// ─────────────────────────────────────────────────────────────────────
function WorkloadRecommendations({ modelList, calculatorInputs, scenarioMultiplier, onPickModel }) {
  const [budget, setBudget] = useState('')
  const [requireOpen, setRequireOpen] = useState(false)

  const workload = useMemo(() => ({
    requestsPerDay: calculatorInputs.requestsPerDay,
    inputTokens: calculatorInputs.inputTokens,
    outputTokens: calculatorInputs.outputTokens,
    cachingHitRate: calculatorInputs.cachingHitRate,
    scenarioMultiplier,
  }), [calculatorInputs, scenarioMultiplier])

  const recommendations = useMemo(() => {
    const parsedBudget = budget && Number.isFinite(parseFloat(budget)) ? parseFloat(budget) : null
    return recommendForWorkload(modelList, workload, {
      qualityFloor: 50,
      budget: parsedBudget,
      limit: 3,
      requireOpen,
    })
  }, [modelList, workload, budget, requireOpen])

  if (recommendations.length === 0) {
    return (
      <div className="dash-card p-5">
        <p className="text-xs text-slate-400">Waiting on live model data to compute recommendations…</p>
      </div>
    )
  }

  const tagStyle = (tag) => {
    switch (tag) {
      case 'best-overall': return 'bg-primary/20 text-primary'
      case 'cheapest-decent': return 'bg-emerald-500/20 dark:text-emerald-400 text-emerald-600'
      case 'runner-up': return 'dark:bg-slate-700 bg-slate-200 dark:text-slate-300 text-slate-600'
      case 'over-budget': return 'bg-rose-500/20 dark:text-rose-300 text-rose-600'
      default: return 'dark:bg-slate-700/60 bg-slate-200 dark:text-slate-400 text-slate-600'
    }
  }
  const tagLabel = (tag) => {
    switch (tag) {
      case 'best-overall': return 'Best Overall'
      case 'cheapest-decent': return 'Cheapest Decent'
      case 'runner-up': return 'Runner-Up'
      case 'over-budget': return 'Over Budget'
      default: return 'Alternative'
    }
  }

  return (
    <div className="dash-card p-5">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
        <div>
          <h4 className="label-micro mb-1">Recommended For This Workload</h4>
          <p className="text-[0.6rem] text-slate-500">
            Pareto-ranked across {modelList.length} live models — your req/day, tokens, cache rate factored in.
          </p>
          <details className="text-[0.55rem] text-slate-500 mt-1">
            <summary className="cursor-pointer hover:text-slate-300 transition-colors">How are these ranked?</summary>
            <p className="mt-1 leading-relaxed">
              score = arenaScore − 30 × log₁₀(monthlyCost + 1). Arena Score is crowd-preference ELO mapped
              to 0-100. The log-cost penalty means a $1K/mo model needs ~90 more arena points to beat a $1/mo one.
              At equal score, cheaper wins; at equal cost, higher-ranked wins.
            </p>
          </details>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[0.65rem] text-slate-400 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={requireOpen}
              onChange={e => setRequireOpen(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary"
            />
            Open-source only
          </label>
          <div className="flex items-center gap-1 text-[0.65rem] text-slate-400">
            <span>Max $/mo</span>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="any"
              min="0"
              className="w-16 bg-slate-800/80 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {recommendations.map(rec => (
          <div
            key={rec.model.id}
            className="dark:bg-slate-800/40 bg-white border dark:border-slate-700/40 border-slate-200 rounded-lg p-4 hover:border-primary/40 transition-all flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[0.55rem] font-black tracking-wider uppercase px-1.5 py-0.5 rounded ${tagStyle(rec.tag)}`}>
                {tagLabel(rec.tag)}
              </span>
              <span className="text-xs font-mono text-white">
                {rec.monthlyCost >= 1000
                  ? `$${(rec.monthlyCost / 1000).toFixed(1)}K/mo`
                  : rec.monthlyCost >= 1
                    ? `$${rec.monthlyCost.toFixed(0)}/mo`
                    : `$${rec.monthlyCost.toFixed(2)}/mo`}
              </span>
            </div>
            <h5 className="text-sm font-bold text-white leading-tight">{rec.model.name}</h5>
            <div className="flex items-center gap-2 text-[0.65rem] text-slate-400">
              <span className="material-symbols-outlined text-primary/60 text-xs">{rec.model.providerIcon || 'smart_toy'}</span>
              <span>{rec.model.provider}</span>
              <span className="text-slate-600">·</span>
              <span>Arena {rec.model.qualityScore || '—'}</span>
              {rec.model.arenaElo > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>ELO {rec.model.arenaElo}</span>
                </>
              )}
            </div>
            <p className="text-[0.7rem] text-slate-400 leading-relaxed flex-1">{rec.reason}</p>
            <button
              onClick={() => onPickModel(rec.model)}
              disabled={calculatorInputs.selectedModelId === rec.model.id}
              className="text-[0.6rem] font-black tracking-widest text-primary border border-primary/30 px-2 py-1.5 rounded hover:bg-primary hover:text-on-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {calculatorInputs.selectedModelId === rec.model.id ? 'CURRENT PICK' : 'USE THIS MODEL'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
