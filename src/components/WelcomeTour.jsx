import { useState, useEffect } from 'react'
import useDashboardStore from '../store/dashboardStore'

const STORAGE_KEY = 'inferscope-tour-seen-v1'

const STEPS = [
  {
    icon: 'leaderboard',
    title: 'Model Arena',
    body: 'A live leaderboard of every major LLM. Compare Arena ELO, quality, price-per-token, and speed side by side. The best value is always at the top.',
    badge: 'TAB 1',
  },
  {
    icon: 'calculate',
    title: 'Cost Calculator',
    body: 'Project exactly what a model will cost at your scale. Token volumes, cache hit rate, and traffic profiles feed a live cost breakdown with monthly and annual forecasts.',
    badge: 'TAB 2',
  },
  {
    icon: 'dns',
    title: 'Infra Explorer',
    body: '15 API providers and 10 GPU options with side-by-side comparison. Pick a GPU row, hit Compare, and see efficiency, throughput, and $/VRAM ratios in one view.',
    badge: 'TAB 3',
  },
  {
    icon: 'auto_awesome',
    title: 'AI Advisor',
    body: 'Ask questions in plain English. The advisor knows your selected model, calculator scenario, and live pricing, so every recommendation is grounded in your dashboard state.',
    badge: 'FLOATING',
  },
]

export default function WelcomeTour() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Delay so the initial page paint lands first
        const t = setTimeout(() => setVisible(true), 600)
        return () => clearTimeout(t)
      }
    } catch {
      // localStorage disabled: just don't show
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1
      setStep(nextStep)
      // Preview the tab as the user reads about it
      if (nextStep < 3) setActiveTab(nextStep)
    } else {
      setActiveTab(0)
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md dark:bg-dash-card bg-white rounded-2xl dark:shadow-2xl dark:shadow-black/50 shadow-xl border dark:border-slate-700/50 border-slate-200 overflow-hidden">
        {/* Gradient top stripe */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">{current.icon}</span>
            </div>
            <span className="text-[0.6rem] font-black tracking-wider uppercase px-2 py-1 rounded bg-primary/10 text-primary">
              {current.badge}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-black dark:text-white text-slate-800 tracking-tight">{current.title}</h2>
            <p className="text-sm dark:text-slate-400 text-slate-600 mt-2 leading-relaxed">{current.body}</p>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-1.5 pt-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'dark:bg-slate-700 bg-slate-200'}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={dismiss}
              className="text-xs dark:text-slate-400 text-slate-500 hover:text-primary transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs dark:text-slate-500 text-slate-400 tabular-nums">{step + 1} / {STEPS.length}</span>
              <button
                onClick={next}
                className="text-[0.7rem] font-black tracking-widest uppercase bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(255,225,136,0.25)]"
              >
                {isLast ? "Let's go" : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
