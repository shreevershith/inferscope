import { useState, useRef, useEffect } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { sendChatMessage } from '../../lib/aiClient'

const SUGGESTED_QUESTIONS = [
  'Compare Claude vs GPT for code',
  'Best model under $500/mo',
  'RAG chatbot setup costs',
  'Cheapest model for document extraction',
  'When should I use caching?',
]

export default function AdvisorPanel() {
  const setAdvisorPanelOpen = useDashboardStore(s => s.setAdvisorPanelOpen)
  const chatMessages = useDashboardStore(s => s.chatMessages)
  const addChatMessage = useDashboardStore(s => s.addChatMessage)
  const isChatLoading = useDashboardStore(s => s.isChatLoading)
  const setChatLoading = useDashboardStore(s => s.setChatLoading)
  const getAdvisorContext = useDashboardStore(s => s.getAdvisorContext)
  const calculatorInputs = useDashboardStore(s => s.calculatorInputs)
  const modelList = useDashboardStore(s => s.modelList)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const prevMsgCount = useRef(chatMessages.length)

  useEffect(() => {
    // Only scroll when a new message is appended (not on every render)
    if (chatMessages.length > prevMsgCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMsgCount.current = chatMessages.length
  }, [chatMessages.length])

  const handleSend = async (text) => {
    const message = text || input.trim()
    if (!message || isChatLoading) return

    setInput('')
    addChatMessage({ role: 'user', text: message })
    setChatLoading(true)

    try {
      const context = getAdvisorContext()
      const response = await sendChatMessage(message, context)
      addChatMessage({ role: 'assistant', text: response })
    } catch (err) {
      console.error('Advisor error:', err)
      const errorMsg = err.message?.includes('fetch')
        ? 'Network connection error. Please check your connection.'
        : 'Unable to respond right now. Please try again.'
      addChatMessage({ role: 'assistant', text: errorMsg, isError: true })
    } finally {
      setChatLoading(false)
    }
  }

  // Context cards: what the AI actually has access to
  const topModel = modelList?.[0]
  const contextCards = [
    calculatorInputs.selectedModelName && {
      label: 'Selected Model',
      value: calculatorInputs.selectedModelName,
      sub: `$${calculatorInputs.inputPricePerMToken?.toFixed(2) || '—'}/M input`,
      icon: 'smart_toy',
    },
    {
      label: 'Request Volume',
      value: calculatorInputs.requestsPerDay >= 1000
        ? `${(calculatorInputs.requestsPerDay / 1000).toFixed(0)}K / day`
        : `${calculatorInputs.requestsPerDay} / day`,
      sub: `${calculatorInputs.scenario || 'base'} scenario`,
      icon: 'speed',
    },
    {
      label: 'Cache Hit Rate',
      value: `${calculatorInputs.cachingHitRate || 0}%`,
      sub: 'of input tokens',
      icon: 'memory',
    },
    topModel && {
      label: 'Top Ranked',
      value: topModel.name,
      sub: `ELO ${topModel.arenaElo || '—'}`,
      icon: 'leaderboard',
    },
  ].filter(Boolean)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:bg-transparent"
        onClick={() => setAdvisorPanelOpen(false)}
      />

      {/* Panel: wider to fit context sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-md lg:max-w-2xl dark:bg-dash-card bg-white border-l dark:border-slate-700/50 border-slate-200 z-50 flex flex-col dark:shadow-2xl dark:shadow-black/50 shadow-xl shadow-slate-300/50 animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700/50 border-slate-200">
          <h3 className="font-black dark:text-white text-slate-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            AI Advisor
            <span className="text-[0.6rem] font-medium dark:text-slate-500 text-slate-400 tracking-wider uppercase ml-1">Powered by Groq · Llama 3.3</span>
          </h3>
          <button
            onClick={() => setAdvisorPanelOpen(false)}
            className="dark:text-slate-400 text-slate-500 dark:hover:text-white hover:text-slate-800 transition-colors p-1"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Main split: chat (left/main) + context sidebar (right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 dark:bg-dash-card bg-slate-50">
              {chatMessages.length === 0 && (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-primary/40 text-5xl mb-4 block">psychology</span>
                  <p className="text-sm dark:text-slate-300 text-slate-700 font-medium">Ask about your investment</p>
                  <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 max-w-xs mx-auto">
                    I can see your selected model, calculator scenario, and live pricing. Try a suggested question →
                  </p>
                </div>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] px-4 py-3 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'dark:bg-slate-700 bg-amber-50 dark:text-white text-slate-800 dark:border-0 border border-amber-200/50'
                      : msg.isError
                        ? 'bg-rose-950/40 text-rose-200 border border-rose-900/50'
                        : 'dark:bg-slate-800/60 bg-white dark:text-slate-200 text-slate-700 border dark:border-slate-700/50 border-slate-200'
                  }`}>
                    {msg.role === 'assistant' && !msg.isError && (
                      <p className="label-micro text-primary mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">auto_awesome</span>
                        InferScope Advisor
                      </p>
                    )}
                    {msg.isError && (
                      <p className="label-micro text-rose-400 mb-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">error</span>
                        Error
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="dark:bg-slate-800/60 bg-white px-4 py-3 rounded-lg border dark:border-slate-700/50 border-slate-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t dark:border-slate-700/50 border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about models, costs, infrastructure..."
                  className="flex-1 dark:bg-slate-800/60 bg-slate-100 border dark:border-slate-700 border-slate-300 rounded-lg px-4 py-2.5 text-sm dark:text-white text-slate-800 dark:placeholder-slate-500 placeholder-slate-400 outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isChatLoading || !input.trim()}
                  className="bg-primary text-on-primary p-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30"
                  aria-label="Send"
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
              </div>
              <p className="text-[0.6rem] dark:text-slate-500 text-slate-400 mt-2 tracking-wider uppercase">
                Shift + Enter for new line
              </p>
            </div>
          </div>

          {/* Right sidebar: Active Context Feed + Suggested Questions */}
          <aside className="hidden lg:flex lg:flex-col w-72 border-l dark:border-slate-700/50 border-slate-200 dark:bg-slate-900/30 bg-amber-50/40 overflow-y-auto">
            <div className="p-5 space-y-4">
              <div>
                <p className="label-micro mb-3">Active Context Feed</p>
                <div className="space-y-2">
                  {contextCards.map(card => (
                    <div
                      key={card.label}
                      className="dark:bg-slate-800/60 bg-white rounded-lg p-3 border dark:border-slate-700/40 border-slate-200"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-primary/70 text-sm">{card.icon}</span>
                        <p className="text-[0.6rem] font-black tracking-wider uppercase dark:text-slate-500 text-slate-500">{card.label}</p>
                      </div>
                      <p className="text-sm font-bold dark:text-white text-slate-800 truncate" title={card.value}>{card.value}</p>
                      <p className="text-[0.65rem] dark:text-slate-500 text-slate-500 mt-0.5">{card.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-micro mb-3">Suggested Questions</p>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      disabled={isChatLoading}
                      className="w-full text-left text-xs dark:text-slate-300 text-slate-700 dark:bg-slate-800/40 bg-white border dark:border-slate-700/40 border-slate-200 px-3 py-2 rounded-lg hover:border-primary/50 hover:text-primary transition-all disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
