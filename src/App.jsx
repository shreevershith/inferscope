import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import useDashboardStore from './store/dashboardStore'
import ErrorBoundary from './components/ui/ErrorBoundary'
import HeroBanner from './components/HeroBanner'
import StaleCacheBanner from './components/StaleCacheBanner'
import WelcomeTour from './components/WelcomeTour'
import Footer from './components/Footer'
import { pickChapterToAutoStart } from './lib/tourTriggers'
import { initAnalytics, events } from './lib/telemetry'
import ConsentBanner from './components/ConsentBanner'

// Code-split tabs and the Advisor — keep initial bundle small.
// Each tab + the advisor panel are only fetched when the user opens them.
const ModelArena     = lazy(() => import('./tabs/ModelArena'))
const CostCalculator = lazy(() => import('./tabs/CostCalculator'))
const InfraExplorer  = lazy(() => import('./tabs/InfraExplorer'))
const AdvisorPanel   = lazy(() => import('./components/advisor/AdvisorPanel'))

function TabFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading tab">
      <div className="animate-pulse text-slate-500 text-sm font-medium">Loading…</div>
    </div>
  )
}

const TABS = [
  { name: 'Model Arena', icon: 'leaderboard' },
  { name: 'Cost Calculator', icon: 'calculate' },
  { name: 'Infra Explorer', icon: 'dns' },
]

const CHAPTER_LABELS = {
  A: { name: 'Arena Intro', icon: 'leaderboard' },
  B: { name: 'Cost Calculator', icon: 'calculate' },
  C: { name: 'Infra Explorer', icon: 'dns' },
  D: { name: 'AI Advisor', icon: 'auto_awesome' },
}

function TakeTourMenu({ onPick }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="hover:bg-slate-800/50 transition-all p-2 rounded-lg text-slate-400 hover:text-primary"
        title="Take tour"
      >
        <span className="material-symbols-outlined">school</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 dark:bg-dash-card bg-white rounded-lg dark:shadow-2xl shadow-xl border dark:border-slate-700/50 border-slate-200 overflow-hidden z-40 animate-fadeIn">
          <div className="px-3 py-2 border-b dark:border-slate-700/50 border-slate-200">
            <p className="text-[0.6rem] font-black tracking-wider uppercase dark:text-slate-500 text-slate-500">Restart tour</p>
          </div>
          {Object.entries(CHAPTER_LABELS).map(([id, info]) => (
            <button
              key={id}
              onClick={() => { setOpen(false); onPick(id) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm dark:text-slate-300 text-slate-700 dark:hover:bg-slate-700/50 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-primary text-base">{info.icon}</span>
              <span className="flex-1">{info.name}</span>
              <span className="material-symbols-outlined text-slate-400 text-sm">refresh</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const activeTab = useDashboardStore(s => s.activeTab)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const toggleAdvisorPanel = useDashboardStore(s => s.toggleAdvisorPanel)
  const setAdvisorPanelOpen = useDashboardStore(s => s.setAdvisorPanelOpen)
  const isPanelOpen = useDashboardStore(s => s.isPanelOpen)
  const theme = useDashboardStore(s => s.theme)
  const setTheme = useDashboardStore(s => s.setTheme)
  const tourChapter = useDashboardStore(s => s.tourChapter)
  const startChapter = useDashboardStore(s => s.startChapter)

  // Auto-start contextual chapters based on current state
  // Runs when activeTab, isPanelOpen, or tourChapter change.
  const hasBooted = useRef(false)
  useEffect(() => {
    const delay = hasBooted.current ? 200 : 700  // longer on first boot so initial paint lands
    hasBooted.current = true
    const timer = setTimeout(() => {
      const chapter = pickChapterToAutoStart({ activeTab, isPanelOpen, tourChapter })
      if (chapter) startChapter(chapter)
    }, delay)
    return () => clearTimeout(timer)
  }, [activeTab, isPanelOpen, tourChapter, startChapter])

  // Initialize analytics once on mount (loads GA if user previously consented)
  useEffect(() => {
    initAnalytics()
  }, [])

  // Track tab switches
  useEffect(() => {
    const names = ['Model Arena', 'Cost Calculator', 'Infra Explorer']
    events.tabSwitch(names[activeTab])
  }, [activeTab])

  // Track advisor opens (only on open, not close)
  const prevPanelOpen = useRef(false)
  useEffect(() => {
    if (isPanelOpen && !prevPanelOpen.current) events.advisorOpen()
    prevPanelOpen.current = isPanelOpen
  }, [isPanelOpen])

  // Re-trigger helper: for chapters B/C/D, need to set the right tab/panel first
  const handleTourPick = (chapterId) => {
    if (chapterId === 'A') {
      setActiveTab(0)
    } else if (chapterId === 'B') {
      setActiveTab(1)
    } else if (chapterId === 'C') {
      setActiveTab(2)
    } else if (chapterId === 'D') {
      setActiveTab(0)
      setAdvisorPanelOpen(true)
    }
    events.tourChapterStart(chapterId, 'manual')
    // Small delay to ensure the target elements exist in DOM before starting
    setTimeout(() => startChapter(chapterId), 200)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="w-full sticky top-0 dark:bg-dash-bg/90 bg-white/90 backdrop-blur-xl z-30 border-b dark:border-slate-800 border-slate-200">
        <div className="flex justify-between items-center px-8 h-16 max-w-[1920px] mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>insights</span>
            <span className="text-2xl font-black tracking-tighter text-primary dark:text-primary text-amber-600 brand-glow">
              InferScope
            </span>
          </div>

          {/* Tab Navigation */}
          <nav data-tour="header-tabs" className="hidden md:flex items-center gap-8 text-sm tracking-tight font-medium">
            {TABS.map((tab, i) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(i)}
                className={`pb-1 transition-colors ${
                  activeTab === i
                    ? 'dark:text-primary text-amber-600 font-bold border-b-2 dark:border-primary border-amber-600'
                    : 'text-slate-400 dark:hover:text-slate-200 hover:text-slate-700'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TakeTourMenu onPick={handleTourPick} />
            <button
              onClick={() => {
                const html = document.documentElement
                const isDark = html.classList.contains('dark')
                if (isDark) {
                  html.classList.remove('dark')
                  setTheme('light')
                  events.themeToggle('light')
                } else {
                  html.classList.add('dark')
                  setTheme('dark')
                  events.themeToggle('dark')
                }
              }}
              data-tour="theme-toggle"
              className="hover:bg-slate-800/50 transition-all p-2 rounded-lg text-slate-400 hover:text-primary"
              title="Toggle theme"
            >
              <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-slate-800 ring-2 ring-primary/20 flex items-center justify-center text-xs font-bold text-primary ml-2">
              U
            </div>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="md:hidden flex border-t border-slate-800">
          {TABS.map((tab, i) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(i)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[0.6rem] font-bold uppercase tracking-wider transition-colors ${
                activeTab === i ? 'text-primary' : 'text-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>
      </header>

      {/* Stale-cache warning — only renders when both fetches failed AND we
          have prior cache to fall back on. Quiet by default. */}
      <StaleCacheBanner />

      {/* Hero Banner */}
      <HeroBanner />

      {/* Main Content. The `key` on ErrorBoundary forces a fresh boundary per
          tab so a crash in one tab doesn't keep the error UI showing after
          the user switches to another. */}
      <main className="max-w-[1920px] mx-auto px-4 md:px-8 py-8">
        <ErrorBoundary key={`tab-${activeTab}`}>
          <Suspense fallback={<TabFallback />}>
            <div className="animate-fadeIn">
              {activeTab === 0 && <ModelArena />}
              {activeTab === 1 && <CostCalculator />}
              {activeTab === 2 && <InfraExplorer />}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* AI Advisor FAB */}
      <button
        data-tour="advisor-fab"
        onClick={toggleAdvisorPanel}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary rounded-full glow-primary flex items-center justify-center text-on-primary hover:scale-110 active:scale-95 transition-all z-30"
        title="AI Advisor"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
      </button>

      {/* AI Advisor Panel: only mount when open to avoid 8 idle subscriptions.
          Wrapped in ErrorBoundary so a panel crash (chunk load failure, render
          bug) doesn't take down the whole app. */}
      {isPanelOpen && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <AdvisorPanel />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Contextual workflow tour (auto-fires per-section on first visit) */}
      <WelcomeTour />

      {/* Cookie consent banner (first visit only) */}
      <ConsentBanner />
    </div>
  )
}
