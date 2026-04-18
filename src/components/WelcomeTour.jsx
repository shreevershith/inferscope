import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import useDashboardStore from '../store/dashboardStore'
import { markSeen } from '../lib/tourTriggers'

// ─── Chapter config ────────────────────────────────────────────────────────
// Each step:
//   { id, selector, title, body, placement, preTab, onEnter, onLeave, icon }
// selector = null → centered modal (no spotlight)
// placement ∈ 'top' | 'bottom' | 'left' | 'right' | 'center'

const CHAPTERS = {
  A: [
    {
      id: 'welcome',
      selector: null,
      icon: 'waving_hand',
      badge: 'WELCOME',
      title: "Welcome to InferScope",
      body: "Your AI model intelligence dashboard. Let's take a quick tour of the Model Arena so you know what to look at and how to use it.",
      placement: 'center',
    },
    {
      id: 'header-tabs',
      selector: '[data-tour="header-tabs"]',
      icon: 'tab',
      badge: 'NAVIGATION',
      title: "Three sections",
      body: "Model Arena (here) lists every LLM. Cost Calculator projects what a model will cost you. Infra Explorer compares hosting providers.",
      placement: 'bottom',
    },
    {
      id: 'arena-table',
      selector: '[data-tour="arena-table"]',
      icon: 'leaderboard',
      badge: 'LEADERBOARD',
      title: "The Arena Leaderboard",
      body: "Every LLM ranked by Arena ELO — higher = humans preferred its answers in blind A/B comparisons.",
      placement: 'top',
    },
    {
      id: 'arena-filters',
      selector: '[data-tour="arena-filters"]',
      icon: 'filter_alt',
      badge: 'FILTERS',
      title: "Filter the list",
      body: "Filter by provider, license, or focus task (Code, Reasoning, Chat, Creative). Use the search box for quick lookup.",
      placement: 'bottom',
    },
    {
      id: 'arena-value',
      selector: '[data-tour="arena-value-col"]',
      icon: 'star',
      badge: 'VALUE SCORE',
      title: "Quality per dollar",
      body: "Our Value Score is quality ÷ price. Green 'Excellent' = you get a lot of smart answers for very little money.",
      placement: 'bottom',
    },
    {
      id: 'arena-compare',
      selector: '[data-tour="arena-compare-col"]',
      icon: 'compare',
      badge: 'COMPARE',
      title: "Compare 2-3 models",
      body: "Tick the checkboxes on any rows to pull up a side-by-side radar chart comparing Quality, Speed, Context, and Affordability.",
      placement: 'right',
    },
    {
      id: 'arena-insight',
      selector: '[data-tour="arena-insight"]',
      icon: 'analytics',
      badge: 'INSIGHT',
      title: "The Arena Insight panel",
      body: "Switch views: ELO ranking, Price, Speed, or Value. Click any bar to highlight that model's row in the table.",
      placement: 'left',
    },
  ],
  B: [
    {
      id: 'calc-inputs',
      selector: '[data-tour="calc-inputs"]',
      icon: 'tune',
      badge: 'INPUTS',
      title: "Dial in your workload",
      body: "Pick a model, set token volumes, request rate, and cache hit %. Every field updates the cost projections below in real time.",
      placement: 'right',
    },
    {
      id: 'calc-metrics',
      selector: '[data-tour="calc-metrics"]',
      icon: 'payments',
      badge: 'RESULTS',
      title: "Cost at a glance",
      body: "Monthly cost, cost-per-request, annual projection, and savings from caching. The (i) info icons explain each formula.",
      placement: 'top',
    },
    {
      id: 'calc-charts',
      selector: '[data-tour="calc-charts"]',
      icon: 'show_chart',
      badge: 'CHARTS',
      title: "Where your money goes",
      body: "The bar chart splits input vs output costs. The line chart shows how cost scales as your request volume grows.",
      placement: 'top',
    },
  ],
  C: [
    {
      id: 'infra-providers',
      selector: '[data-tour="infra-providers"]',
      icon: 'dns',
      badge: 'PROVIDERS',
      title: "15 API providers at a glance",
      body: "Each card shows model count, price range, and speed tier. Click ESTIMATE COST on any provider to pre-fill the Cost Calculator.",
      placement: 'bottom',
    },
    {
      id: 'infra-gpus',
      selector: '[data-tour="infra-gpus"]',
      icon: 'memory',
      badge: 'GPU PRICING',
      title: "Self-hosting options",
      body: "Running your own LLM? Here are H100 / A100 / L40S / RTX 4090 prices across major clouds, with throughput and TFLOPS specs.",
      placement: 'top',
    },
    {
      id: 'infra-compare',
      selector: '[data-tour="infra-compare"]',
      icon: 'compare_arrows',
      badge: 'COMPARE',
      title: "Compare GPUs side-by-side",
      body: "Tick any 2-3 GPU rows and hit COMPARE SELECTED to see efficiency and $/VRAM ratios in a drawer.",
      placement: 'right',
    },
  ],
  D: [
    {
      id: 'advisor-context',
      selector: '[data-tour="advisor-context"]',
      icon: 'sensors',
      badge: 'GROUNDED',
      title: "Your Advisor sees your dashboard",
      body: "These cards show the live context: your selected model, calculator scenario, and pricing snapshot. Every answer is grounded in your real data — not generic web chatbot output.",
      placement: 'left',
    },
    {
      id: 'advisor-input',
      selector: '[data-tour="advisor-input"]',
      icon: 'chat',
      badge: 'ASK ANYTHING',
      title: "Ask in plain English",
      body: "Try a suggested question, or ask anything about models, costs, or infrastructure. The AI knows your workload and recommends the best fit.",
      placement: 'left',
    },
  ],
}

// ─── Spotlight geometry hook ───────────────────────────────────────────────
function useTargetRect(selector) {
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    if (!selector) { setRect(null); return }

    let rafId = null

    const measure = () => {
      const el = document.querySelector(selector)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      })
    }

    // Measure now and keep up to date with scroll/resize
    measure()

    const rafMeasure = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(measure)
    }

    // Poll for ~1.2s after selector change so we catch smooth-scroll completion
    // (scroll events fire throughout, but this is a belt-and-suspenders approach
    // for cases where the target element is lazily rendered or scroll is instant)
    const pollInterval = setInterval(measure, 100)
    const pollTimeout = setTimeout(() => clearInterval(pollInterval), 1200)

    window.addEventListener('scroll', rafMeasure, true)
    window.addEventListener('resize', rafMeasure)
    const ro = new ResizeObserver(rafMeasure)
    const el = document.querySelector(selector)
    if (el) ro.observe(el)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(pollTimeout)
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', rafMeasure, true)
      window.removeEventListener('resize', rafMeasure)
      ro.disconnect()
    }
  }, [selector])

  return rect
}

// ─── Tooltip position helper ───────────────────────────────────────────────
function computeTooltipPosition(rect, placement, tooltipSize) {
  const margin = 16
  const vw = window.innerWidth
  const vh = window.innerHeight
  const { width: tw, height: th } = tooltipSize

  if (!rect) {
    return {
      top: vh / 2 - th / 2,
      left: vw / 2 - tw / 2,
    }
  }

  let top, left
  switch (placement) {
    case 'top':
      top = rect.top - th - margin
      left = rect.left + rect.width / 2 - tw / 2
      break
    case 'bottom':
      top = rect.top + rect.height + margin
      left = rect.left + rect.width / 2 - tw / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - th / 2
      left = rect.left - tw - margin
      break
    case 'right':
      top = rect.top + rect.height / 2 - th / 2
      left = rect.left + rect.width + margin
      break
    default:
      top = vh / 2 - th / 2
      left = vw / 2 - tw / 2
  }

  // Clamp to viewport
  top = Math.max(margin, Math.min(vh - th - margin, top))
  left = Math.max(margin, Math.min(vw - tw - margin, left))

  return { top, left }
}

// ─── Main component ────────────────────────────────────────────────────────
export default function WelcomeTour() {
  const tourChapter = useDashboardStore(s => s.tourChapter)
  const tourStep = useDashboardStore(s => s.tourStep)
  const nextStep = useDashboardStore(s => s.nextStep)
  const prevStep = useDashboardStore(s => s.prevStep)
  const endChapter = useDashboardStore(s => s.endChapter)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)

  const tooltipRef = useRef(null)
  const [tooltipSize, setTooltipSize] = useState({ width: 360, height: 220 })
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const chapter = tourChapter ? CHAPTERS[tourChapter] : null
  const step = chapter?.[tourStep]
  // On mobile, force selector to null → centered modal
  const effectiveSelector = isMobile ? null : step?.selector
  const rect = useTargetRect(effectiveSelector)

  // Measure tooltip so we can position accurately
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const r = tooltipRef.current.getBoundingClientRect()
      setTooltipSize({ width: r.width, height: r.height })
    }
  }, [tourChapter, tourStep, rect])

  // Scroll target into view when step changes
  useEffect(() => {
    if (!effectiveSelector) return
    const el = document.querySelector(effectiveSelector)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
  }, [effectiveSelector])

  // Keyboard nav
  useEffect(() => {
    if (!chapter) return
    const onKey = (e) => {
      if (e.key === 'Escape') handleSkip()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, tourStep])

  if (!chapter || !step) return null

  const isLast = tourStep === chapter.length - 1
  const isFirst = tourStep === 0

  function handleNext() {
    if (isLast) handleFinish()
    else nextStep()
  }

  function handlePrev() {
    if (!isFirst) prevStep()
  }

  function handleFinish() {
    markSeen(tourChapter)
    endChapter()
  }

  function handleSkip() {
    markSeen(tourChapter)
    endChapter()
  }

  const placement = step.placement || 'center'
  const useSpotlight = !!effectiveSelector && !!rect && placement !== 'center'

  const tooltipPos = computeTooltipPosition(rect, placement, tooltipSize)

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Backdrop: spotlight cutout via outer box-shadow, OR plain dim for centered modal */}
      {useSpotlight ? (
        <div
          className="absolute pointer-events-auto rounded-lg ring-2 ring-primary/70"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          }}
          onClick={(e) => { e.stopPropagation() /* allow user to still click target if they want */ }}
        />
      ) : (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={handleSkip}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        key={`${tourChapter}-${tourStep}`}
        className="absolute pointer-events-auto w-[360px] max-w-[90vw] dark:bg-dash-card bg-white rounded-2xl dark:shadow-2xl dark:shadow-black/50 shadow-xl border dark:border-slate-700/50 border-slate-200 overflow-hidden animate-fadeIn"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        {/* Gradient top stripe */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-xl">{step.icon || 'info'}</span>
            </div>
            <span className="text-[0.6rem] font-black tracking-wider uppercase px-2 py-1 rounded bg-primary/10 text-primary">
              {step.badge || `STEP ${tourStep + 1}`}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-black dark:text-white text-slate-800 tracking-tight">{step.title}</h2>
            <p className="text-sm dark:text-slate-400 text-slate-600 mt-1.5 leading-relaxed">{step.body}</p>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-1 pt-1">
            {chapter.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${i === tourStep ? 'bg-primary' : i < tourStep ? 'bg-primary/40' : 'dark:bg-slate-700 bg-slate-200'}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleSkip}
              className="text-xs dark:text-slate-400 text-slate-500 hover:text-primary transition-colors"
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs dark:text-slate-500 text-slate-400 tabular-nums">{tourStep + 1} / {chapter.length}</span>
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="text-xs dark:text-slate-400 text-slate-500 hover:text-primary transition-colors px-3 py-2"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="text-[0.7rem] font-black tracking-widest uppercase bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(255,225,136,0.25)]"
              >
                {isLast ? "Got it" : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
