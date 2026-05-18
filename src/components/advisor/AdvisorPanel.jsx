import { useState, useRef, useEffect, useMemo } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { sendChatMessage } from '../../lib/aiClient'
import { events } from '../../lib/telemetry'
import { buildSuggestedQuestions } from '../../lib/advisorPrompts'

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

  // Personalized suggestions — recompute when model list or calc state change.
  const suggestedQuestions = useMemo(
    () => buildSuggestedQuestions({ models: modelList, calculatorInputs }),
    [modelList, calculatorInputs]
  )

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

    // Track which path user took: suggested chip vs typed
    if (text && suggestedQuestions.includes(text)) {
      events.advisorSuggestedClick(text)
    } else {
      events.advisorMessageSent(message.length)
    }

    setInput('')
    addChatMessage({ role: 'user', text: message })
    setChatLoading(true)

    try {
      const context = getAdvisorContext()
      const response = await sendChatMessage(message, context)
      addChatMessage({ role: 'assistant', text: response })
    } catch (err) {
      console.error('Advisor error:', err)
      // AiClientError carries .source so we can show a targeted message
      // instead of a generic "something failed". Falls back gracefully when
      // the error is some other shape (e.g. thrown by React internals).
      let errorMsg
      switch (err?.source) {
        case 'timeout':
          errorMsg = 'The AI took too long to respond. Try a shorter question.'
          break
        case 'network':
          errorMsg = 'Network unavailable. Check your connection and try again.'
          break
        case 'rate-limited':
          errorMsg = 'AI service is busy. Please wait a moment and retry.'
          break
        case 'empty':
        case 'parse':
          errorMsg = 'AI service returned an unexpected response. Try rephrasing.'
          break
        case 'server':
          errorMsg = err.message || 'AI service is temporarily unavailable.'
          break
        default:
          errorMsg = 'Unable to respond right now. Please try again.'
      }
      addChatMessage({ role: 'assistant', text: errorMsg, isError: true })
    } finally {
      setChatLoading(false)
    }
  }

  // Live monthly-cost projection for the selected model, mirroring the same
  // math the Cost Calculator uses. Shown in the context feed so the user can
  // see what the Advisor sees at a glance.
  const monthlyCostLabel = useMemo(() => {
    if (!calculatorInputs.selectedModelId) return null
    const inP = calculatorInputs.inputPricePerMToken || 0
    const outP = calculatorInputs.outputPricePerMToken || 0
    const cachedP = calculatorInputs.cachedInputPrice || 0
    const reqMo = (calculatorInputs.requestsPerDay || 0) * 30
    const inMo = reqMo * (calculatorInputs.inputTokens || 0)
    const outMo = reqMo * (calculatorInputs.outputTokens || 0)
    const cacheRate = (calculatorInputs.cachingHitRate || 0) / 100
    const inputCost = (inMo / 1_000_000) * (inP * (1 - cacheRate) + cachedP * cacheRate)
    const outputCost = (outMo / 1_000_000) * outP
    const monthly = inputCost + outputCost
    if (monthly <= 0) return null
    return monthly >= 1000 ? `$${(monthly / 1000).toFixed(1)}K/mo` : `$${monthly.toFixed(2)}/mo`
  }, [calculatorInputs])

  // Context cards: what the AI actually has access to
  const topModel = modelList?.[0]
  const contextCards = [
    calculatorInputs.selectedModelName && {
      label: 'Selected Model',
      value: calculatorInputs.selectedModelName,
      sub: calculatorInputs.inputPricePerMToken > 0
        ? `$${calculatorInputs.inputPricePerMToken.toFixed(2)}/M input`
        : 'Free or variable',
      icon: 'smart_toy',
    },
    monthlyCostLabel && {
      label: 'Projected Cost',
      value: monthlyCostLabel,
      sub: `at ${calculatorInputs.cachingHitRate || 0}% cache hit`,
      icon: 'payments',
    },
    {
      label: 'Request Volume',
      value: calculatorInputs.requestsPerDay >= 1000
        ? `${(calculatorInputs.requestsPerDay / 1000).toFixed(0)}K / day`
        : `${calculatorInputs.requestsPerDay} / day`,
      sub: `${calculatorInputs.scenario || 'base'} scenario`,
      icon: 'speed',
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
                  <p className="text-sm dark:text-slate-300 text-slate-700 font-medium">Ask about your inference workload</p>
                  <p className="text-xs dark:text-slate-400 text-slate-500 mt-1 max-w-xs mx-auto">
                    I can see your selected model, traffic, cache hit rate, projected cost, and the live Arena leaderboard. Try a suggested question →
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
              <div data-tour="advisor-context">
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

              <div data-tour="advisor-input">
                <div className="flex items-center justify-between mb-3">
                  <p className="label-micro">Suggested Questions</p>
                  <span className="text-[0.55rem] font-medium dark:text-slate-500 text-slate-500 tracking-wider uppercase" title="Suggestions update based on your selected model and calculator state">
                    Personalized
                  </span>
                </div>
                <div className="space-y-2">
                  {suggestedQuestions.map(q => (
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
