import useDashboardStore from '../../store/dashboardStore'
import { useCostCalculator } from '../../hooks/useCostCalculator'
import MetricCard from '../../components/ui/MetricCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts'
import { SCENARIO_MULTIPLIERS } from '../../constants/taskCategories'

const fmt = (n) => {
  if (typeof n !== 'number' || !isFinite(n)) return '$—'
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${Math.max(0, n).toFixed(2)}`
}

export default function CostCalculator() {
  const inputs = useDashboardStore(s => s.calculatorInputs)
  const setInputs = useDashboardStore(s => s.setCalculatorInputs)
  const modelList = useDashboardStore(s => s.modelList)
  const { costs, volumeCurve, scenarioComparison } = useCostCalculator()

  const handleInput = (key, value) => {
    setInputs({ [key]: typeof value === 'string' ? parseFloat(value) || 0 : value })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <p className="label-micro mb-1">AI Analysis</p>
          <h2 className="text-xl sm:text-headline-sm font-black text-white">Cost Projection Engine</h2>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">schedule</span>
          Last updated: just now
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="dash-card p-6 space-y-5">
          <h3 className="text-title-md font-black text-white">Estimate Your Costs</h3>

          {/* Model Selector */}
          <div>
            <label className="label-micro text-primary/80 block mb-2">Inference Model</label>
            <select
              value={inputs.selectedModelId || ''}
              onChange={e => {
                const model = modelList.find(m => m.id === e.target.value)
                if (model) {
                  setInputs({
                    selectedModelId: model.id,
                    selectedModelName: model.name,
                    inputPricePerMToken: model.inputPricePerMToken,
                    outputPricePerMToken: model.outputPricePerMToken,
                    cachedInputPrice: model.cachedInputPrice || model.inputPricePerMToken * 0.1,
                  })
                }
              }}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a model</option>
              {modelList.map(m => <option key={m.id} value={m.id}>{m.name} — ${m.inputPricePerMToken}/M</option>)}
            </select>
          </div>

          {/* Token Inputs */}
          {[
            { key: 'inputTokens', label: 'Input Tokens / Req', icon: 'input' },
            { key: 'outputTokens', label: 'Output Tokens / Req', icon: 'output' },
            { key: 'requestsPerDay', label: 'Req. Daily Requests', icon: 'speed' },
          ].map(({ key, label, icon }) => (
            <div key={key}>
              <label className="label-micro text-primary/80 block mb-2">{label}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{icon}</span>
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  value={inputs[key]}
                  onChange={e => handleInput(key, Math.max(0, e.target.value))}
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
              onChange={e => handleInput('cachingHitRate', e.target.value)}
              className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,225,136,0.4)]"
            />
          </div>

          {/* Scenario Toggle */}
          <div>
            <label className="label-micro text-primary/80 block mb-2">Traffic Profile</label>
            <div className="flex bg-slate-800/60 p-1 rounded">
              {Object.entries(SCENARIO_MULTIPLIERS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setInputs({ scenario: key })}
                  className={`flex-1 px-4 py-2 rounded text-label-sm font-bold transition-all ${
                    inputs.scenario === key
                      ? 'bg-primary text-on-primary'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Cards */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              label="Estimated Monthly Cost"
              value={fmt(costs.monthlyCost)}
              sublabel={`Reflecting current ${inputs.selectedModelName || 'model'} pricing`}
              icon="payments"
              accent
              tooltip="Total monthly cost = (input tokens + output tokens) x price per token x requests per day x 30 days, minus caching savings."
            />
            <MetricCard
              label="Average Cost / Request"
              value={`$${costs.costPerRequest.toFixed(4)}`}
              sublabel={costs.costPerRequest < 0.01 ? 'Efficiency: HIGH' : 'Efficiency: MODERATE'}
              icon="speed"
              tooltip="Monthly cost divided by total requests. Below $0.01/req is considered highly cost-efficient."
            />
            <MetricCard
              label="Annual Expenditure"
              value={fmt(costs.annualCost)}
              sublabel="Projected based on current traffic pattern"
              icon="calendar_month"
              tooltip="Monthly cost x 12. Actual costs may vary with pricing changes and traffic fluctuations."
            />
            <MetricCard
              label="Cached Monthly Savings"
              value={fmt(costs.cacheSavings)}
              sublabel={`${inputs.cachingHitRate}% volume offset`}
              icon="savings"
              accent
              tooltip="Amount saved by caching repeated input tokens. Cached tokens cost ~90% less. Increase cache hit rate to maximize savings."
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cost Breakdown */}
            <div className="dash-card p-5">
              <h4 className="label-micro mb-4">Monthly Cost Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[costs.breakdown]} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`$${v.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="inputCost" name="Input" stackId="a" fill="#ffe188" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="outputCost" name="Output" stackId="a" fill="#efc200" />
                  <Bar dataKey="cachedSavings" name="Savings" stackId="a" fill="#4ade80" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost vs Volume */}
            <div className="dash-card p-5">
              <h4 className="label-micro mb-4">Cost vs Volume</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={volumeCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`$${v.toFixed(2)}`, 'Monthly Cost']}
                  />
                  <Line type="monotone" dataKey="monthlyCost" stroke="#ffe188" strokeWidth={2} dot={{ fill: '#ffe188', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
