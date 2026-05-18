import { useEffect, useMemo, useState } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { buildOptimizationTips } from '../../lib/optimizationTips'

const ROTATE_MS = 12_000

function renderSegment(seg, i) {
  const className =
    seg.style === 'bold' ? 'text-white font-semibold'
    : seg.style === 'accent' ? 'text-primary font-semibold'
    : seg.style === 'highlight' ? 'text-emerald-400 font-black'
    : ''
  return className
    ? <span key={i} className={className}>{seg.text}</span>
    : <span key={i}>{seg.text}</span>
}

export default function OptimizationTip({ models }) {
  // Subscribe atomically — selecting `calculatorInputs` whole would re-run
  // the 7 tip generators on every store update (including UI-only changes
  // like `selectedModelName`). Pull only the fields the generators read.
  const selectedModelId = useDashboardStore(s => s.calculatorInputs.selectedModelId)
  const inputTokens = useDashboardStore(s => s.calculatorInputs.inputTokens)
  const outputTokens = useDashboardStore(s => s.calculatorInputs.outputTokens)
  const requestsPerDay = useDashboardStore(s => s.calculatorInputs.requestsPerDay)
  const cachingHitRate = useDashboardStore(s => s.calculatorInputs.cachingHitRate)

  // Build a stable, minimal calc object — only changes when one of the
  // tip-relevant fields actually changes.
  const calculatorInputs = useMemo(
    () => ({ selectedModelId, inputTokens, outputTokens, requestsPerDay, cachingHitRate }),
    [selectedModelId, inputTokens, outputTokens, requestsPerDay, cachingHitRate],
  )

  const tips = useMemo(
    () => buildOptimizationTips({ models, calculatorInputs }),
    [models, calculatorInputs]
  )
  const [idx, setIdx] = useState(0)

  // Reset to 0 whenever the set of available tips changes (e.g. user picks a
  // new model and a context-overkill tip becomes available)
  useEffect(() => { setIdx(0) }, [tips.length])

  // Auto-rotate
  useEffect(() => {
    if (tips.length <= 1) return
    const handle = setInterval(() => {
      setIdx(i => (i + 1) % tips.length)
    }, ROTATE_MS)
    return () => clearInterval(handle)
  }, [tips.length])

  if (tips.length === 0) {
    return (
      <section className="optimization-tip p-4 rounded-lg border border-primary/20 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="bg-primary/20 p-1.5 rounded shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
          </div>
          <div>
            <h4 className="text-xs font-black text-white mb-1">Optimization Tip</h4>
            <p className="text-[0.7rem] text-slate-400 font-medium leading-relaxed">
              Pick a model in the calculator to unlock personalized optimization tips.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const tip = tips[idx % tips.length]

  return (
    <section className="optimization-tip p-4 rounded-lg border border-primary/20 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="bg-primary/20 p-1.5 rounded shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{tip.icon || 'lightbulb'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs font-black text-white truncate">{tip.headline}</h4>
            {tips.length > 1 && (
              <button
                onClick={() => setIdx(i => (i + 1) % tips.length)}
                className="text-[0.55rem] font-bold tracking-wider uppercase text-slate-500 hover:text-primary transition-colors flex items-center gap-0.5 shrink-0"
                title="Next tip"
              >
                <span>{idx + 1}/{tips.length}</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            )}
          </div>
          <p key={tip.id} className="text-[0.7rem] text-slate-400 font-medium leading-relaxed animate-fadeIn">
            {tip.segments.map(renderSegment)}
          </p>
        </div>
      </div>
    </section>
  )
}
