import { useMemo, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts'

/**
 * Pareto frontier: models where no other model has both higher quality AND
 * lower cost.  Walk left-to-right (ascending cost); keep every model whose
 * quality exceeds the best quality seen so far among cheaper models.
 */
function computeParetoIds(data) {
  const sorted = [...data].sort((a, b) => a.cost - b.cost)
  const ids = new Set()
  let maxQ = -Infinity
  for (const m of sorted) {
    if (m.quality > maxQ) {
      ids.add(m.id)
      maxQ = m.quality
    }
  }
  return ids
}

/* ── Custom Tooltip ─────────────────────────────────────────────────── */

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2.5 shadow-xl dark:bg-slate-800 bg-white dark:border-slate-700 border-slate-200 border rounded-lg text-xs">
      <p className="dark:text-white text-slate-800 font-bold text-[0.7rem]">{d.name}</p>
      <p className="dark:text-slate-500 text-slate-400 text-[0.6rem] mb-1.5">{d.provider}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.65rem]">
        <span className="dark:text-slate-400 text-slate-500">Arena Score</span>
        <span className="text-primary font-bold text-right">{d.quality}%</span>
        {d.elo > 0 && <>
          <span className="dark:text-slate-400 text-slate-500">Arena ELO</span>
          <span className="text-primary font-bold text-right">{d.elo}</span>
        </>}
        <span className="dark:text-slate-400 text-slate-500">Output $/M</span>
        <span className="dark:text-white text-slate-800 font-bold text-right">${d.cost.toFixed(2)}</span>
        <span className="dark:text-slate-400 text-slate-500">Input $/M</span>
        <span className="dark:text-white text-slate-800 text-right">${d.inputCost?.toFixed(2) ?? '—'}</span>
      </div>
      {d.isPareto && (
        <div className="mt-2 pt-1.5 dark:border-slate-700/50 border-slate-200 border-t">
          <p className="text-emerald-600 dark:text-emerald-400 text-[0.55rem] font-black tracking-wider">★ PARETO OPTIMAL</p>
        </div>
      )}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────── */

export default function QualityCostScatter({ models, activeTaskIds, highlightedModelId, onModelClick }) {
  const [collapsed, setCollapsed] = useState(false)

  const { fadedData, regularData, paretoData, totalEligible, taskMatchCount, costTicks, costDomain } = useMemo(() => {
    // Only chart models that have real benchmark ELO + valid pricing.
    // Models without ELO use imputed quality tiers (50/55/65/75/85) which
    // create ugly horizontal bands and misrepresent actual performance.
    const eligible = models.filter(m =>
      !m.isVariablePrice &&
      m.outputPricePerMToken != null &&
      m.outputPricePerMToken > 0 &&
      m.qualityScore > 0 &&
      m.arenaElo > 0
    )

    const withCost = eligible.map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      cost: m.outputPricePerMToken,
      quality: m.qualityScore,
      elo: m.arenaElo || 0,
      inputCost: m.inputPricePerMToken,
      isTaskMatch: activeTaskIds ? activeTaskIds.has(m.id) : true,
    }))

    // Pareto frontier computed from task-matched models only (or all
    // when no filter active) so the frontier shifts per task category.
    const matchedModels = withCost.filter(d => d.isTaskMatch)
    const paretoIds = computeParetoIds(matchedModels)

    // Non-matching models rendered as a faded context layer
    const faded = activeTaskIds
      ? withCost.filter(d => !d.isTaskMatch).map(d => ({ ...d, isPareto: false }))
      : []

    const regular = withCost
      .filter(d => d.isTaskMatch && !paretoIds.has(d.id))
      .map(d => ({ ...d, isPareto: false }))

    const pareto = withCost
      .filter(d => d.isTaskMatch && paretoIds.has(d.id))
      .map(d => ({ ...d, isPareto: true }))
      .sort((a, b) => a.cost - b.cost)

    // Log-scale ticks + domain — spreads the $0.10–$5 cluster and compresses
    // expensive outliers ($50–$150) so dots don't pile up on the left.
    const costs = withCost.map(d => d.cost)
    const minC = Math.max(0.05, Math.min(...costs))
    const maxC = Math.max(...costs)
    const LOG_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200]
    const ticks = LOG_TICKS.filter(t => t >= minC * 0.6 && t <= maxC * 1.4)

    return {
      fadedData: faded,
      regularData: regular,
      paretoData: pareto,
      totalEligible: withCost.length,
      taskMatchCount: activeTaskIds ? matchedModels.length : null,
      costTicks: ticks,
      costDomain: [minC * 0.6, maxC * 1.3],
    }
  }, [models, activeTaskIds])

  if (totalEligible < 3) return null

  const handleDotClick = (entry) => {
    const id = entry?.id || entry?.payload?.id
    if (id) onModelClick?.(id)
  }

  return (
    <div data-tour="arena-scatter" className="dash-card p-5">
      <button
        className="w-full flex items-center justify-between mb-1 group"
        onClick={() => setCollapsed(c => !c)}
      >
        <h4 className="label-micro flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-sm">scatter_plot</span>
          Arena Score vs Cost
        </h4>
        <div className="flex items-center gap-2">
          <p className="text-[0.6rem] text-slate-500 uppercase tracking-wider">
            {taskMatchCount != null ? `${taskMatchCount} matching · ` : ''}{totalEligible} models · Log scale
          </p>
          <span className={`material-symbols-outlined text-slate-500 text-sm transition-transform ${collapsed ? '' : 'rotate-180'}`}>
            expand_more
          </span>
        </div>
      </button>

      {!collapsed && <div className="mt-3">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="dark:stroke-slate-700 stroke-slate-200" />
          <XAxis
            type="number"
            dataKey="cost"
            scale="log"
            domain={costDomain}
            ticks={costTicks}
            tick={{ fontSize: 10 }}
            className="dark:[&_text]:fill-slate-400 [&_text]:fill-slate-500"
            tickFormatter={v => `$${v >= 10 ? v.toFixed(0) : v < 1 ? v.toFixed(1) : v.toFixed(0)}`}
          />
          <YAxis
            type="number"
            dataKey="quality"
            tick={{ fontSize: 10 }}
            className="dark:[&_text]:fill-slate-400 [&_text]:fill-slate-500"
            domain={[
              dataMin => Math.max(0, Math.floor((dataMin - 5) / 10) * 10),
              100
            ]}
            tickFormatter={v => `${v}%`}
          />
          {/* Fixed dot radius via ZAxis — keeps all dots uniform */}
          <ZAxis range={[40, 40]} />
          <Tooltip
            content={<ScatterTooltip />}
            cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
          />

          {/* Faded non-matching models (context layer when task filter active) */}
          {fadedData.length > 0 && (
            <Scatter name="Non-matching" data={fadedData} onClick={handleDotClick}>
              {fadedData.map(entry => (
                <Cell
                  key={entry.id}
                  fill={highlightedModelId === entry.id ? '#475569' : 'rgba(148, 163, 184, 0.25)'}
                  stroke={highlightedModelId === entry.id ? '#94a3b8' : 'rgba(100, 116, 139, 0.3)'}
                  strokeWidth={highlightedModelId === entry.id ? 2 : 1}
                />
              ))}
            </Scatter>
          )}

          {/* Task-matched regular models (gold) */}
          <Scatter
            name="Models"
            data={regularData}
            onClick={handleDotClick}
          >
            {regularData.map(entry => (
              <Cell
                key={entry.id}
                fill={highlightedModelId === entry.id ? '#475569' : '#eab308'}
                stroke={highlightedModelId === entry.id ? '#ffe188' : 'rgba(234, 179, 8, 0.4)'}
                strokeWidth={highlightedModelId === entry.id ? 2 : 1}
                fillOpacity={highlightedModelId === entry.id ? 1 : 0.6}
              />
            ))}
          </Scatter>

          {/* Pareto frontier (emerald) with dashed connecting line */}
          <Scatter
            name="Pareto Frontier"
            data={paretoData}
            line={{ stroke: '#16a34a', strokeWidth: 1.5, strokeDasharray: '5 3' }}
            lineType="joint"
            onClick={handleDotClick}
          >
            {paretoData.map(entry => (
              <Cell
                key={entry.id}
                fill={highlightedModelId === entry.id ? '#475569' : '#16a34a'}
                stroke={highlightedModelId === entry.id ? '#16a34a' : 'rgba(22, 163, 74, 0.5)'}
                strokeWidth={highlightedModelId === entry.id ? 2 : 1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
          <span className="dark:text-slate-400 text-slate-600">Pareto frontier ({paretoData.length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="dark:text-slate-400 text-slate-600">{activeTaskIds ? 'Matching models' : 'Other models'}</span>
        </span>
        {fadedData.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400/40 border dark:border-slate-700/50 border-slate-300" />
            <span className="dark:text-slate-500 text-slate-500">Non-matching ({fadedData.length})</span>
          </span>
        )}
        <span className="dark:text-slate-600 text-slate-400 text-[0.55rem] ml-auto">Only models with Arena ELO shown · Click a dot to highlight in table</span>
      </div>
      </div>}
    </div>
  )
}
