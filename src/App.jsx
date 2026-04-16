import { Tab } from '@headlessui/react'
import useDashboardStore from './store/dashboardStore'
import ErrorBoundary from './components/ui/ErrorBoundary'
import AdvisorPanel from './components/advisor/AdvisorPanel'
import ModelArena from './tabs/ModelArena'
import CostCalculator from './tabs/CostCalculator'
import InfraExplorer from './tabs/InfraExplorer'

const TABS = [
  { name: 'Model Arena', icon: 'leaderboard' },
  { name: 'Cost Calculator', icon: 'calculate' },
  { name: 'Infra Explorer', icon: 'dns' },
]

export default function App() {
  const activeTab = useDashboardStore(s => s.activeTab)
  const setActiveTab = useDashboardStore(s => s.setActiveTab)
  const toggleAdvisorPanel = useDashboardStore(s => s.toggleAdvisorPanel)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="w-full sticky top-0 bg-dash-bg/90 backdrop-blur-xl z-30 border-b border-slate-800">
        <div className="flex justify-between items-center px-8 h-16 max-w-[1920px] mx-auto">
          {/* Brand */}
          <div className="text-2xl font-black tracking-tighter text-primary">
            InferScope
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm tracking-tight font-medium">
            {TABS.map((tab, i) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(i)}
                className={`pb-1 transition-colors ${
                  activeTab === i
                    ? 'text-primary font-bold border-b-2 border-primary'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button className="hover:bg-slate-800/50 transition-all p-2 rounded-lg text-slate-400">
              <span className="material-symbols-outlined">dark_mode</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-slate-800 ring-2 ring-primary/20 flex items-center justify-center text-xs font-bold text-primary">
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

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-4 md:px-8 py-8">
        <ErrorBoundary>
          {activeTab === 0 && <ModelArena />}
          {activeTab === 1 && <CostCalculator />}
          {activeTab === 2 && <InfraExplorer />}
        </ErrorBoundary>
      </main>

      {/* AI Advisor FAB */}
      <button
        onClick={toggleAdvisorPanel}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary rounded-full glow-primary flex items-center justify-center text-on-primary hover:scale-110 active:scale-95 transition-all z-30"
        title="AI Advisor"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
      </button>

      {/* AI Advisor Panel */}
      <AdvisorPanel />
    </div>
  )
}
