import { useState, useRef, useEffect } from 'react'
import useDashboardStore from '../../store/dashboardStore'
import { sendChatMessage } from '../../lib/aiClient'

const SUGGESTED_QUESTIONS = [
  'Compare Claude vs GPT for code',
  'Best model under $500/mo',
  'RAG chatbot setup costs',
]

export default function AdvisorPanel() {
  const isPanelOpen = useDashboardStore(s => s.isPanelOpen)
  const setAdvisorPanelOpen = useDashboardStore(s => s.setAdvisorPanelOpen)
  const chatMessages = useDashboardStore(s => s.chatMessages)
  const addChatMessage = useDashboardStore(s => s.addChatMessage)
  const isChatLoading = useDashboardStore(s => s.isChatLoading)
  const setChatLoading = useDashboardStore(s => s.setChatLoading)
  const getAdvisorContext = useDashboardStore(s => s.getAdvisorContext)
  const calculatorInputs = useDashboardStore(s => s.calculatorInputs)

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
      addChatMessage({ role: 'assistant', text: errorMsg })
    } finally {
      setChatLoading(false)
    }
  }

  if (!isPanelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:bg-transparent"
        onClick={() => setAdvisorPanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-md dark:bg-dash-card bg-white border-l dark:border-slate-700/50 border-slate-200 z-50 flex flex-col dark:shadow-2xl dark:shadow-black/50 shadow-xl shadow-slate-300/50 animate-slideInRight">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-700/50 border-slate-200">
          <h3 className="font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            AI Advisor
          </h3>
          <button
            onClick={() => setAdvisorPanelOpen(false)}
            className="dark:text-slate-400 text-slate-500 hover:text-white transition-colors p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Context Badges */}
        <div className="flex gap-2 px-6 py-3 overflow-x-auto no-scrollbar border-b dark:border-slate-700/30 border-slate-200">
          {calculatorInputs.selectedModelName && (
            <span className="text-[0.6rem] font-black tracking-wider uppercase px-2.5 py-1 rounded bg-primary/10 text-primary whitespace-nowrap border border-primary/20">
              {calculatorInputs.selectedModelName} selected
            </span>
          )}
          <span className="text-[0.6rem] font-black tracking-wider uppercase px-2.5 py-1 rounded dark:bg-slate-800 bg-slate-100 dark:text-slate-300 text-slate-600 whitespace-nowrap">
            {calculatorInputs.requestsPerDay >= 1000 ? `${(calculatorInputs.requestsPerDay/1000).toFixed(0)}K` : calculatorInputs.requestsPerDay} req/day
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 dark:bg-dash-card bg-slate-50">
          {chatMessages.length === 0 && (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-primary/30 text-5xl mb-4 block">psychology</span>
              <p className="text-sm dark:text-slate-400 text-slate-500">Ask me about model selection, cost optimization, or infrastructure planning.</p>
            </div>
          )}
          {chatMessages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'dark:bg-slate-700 bg-amber-50 dark:text-white text-slate-800 dark:border-0 border border-amber-200/50'
                  : 'dark:bg-slate-800/60 bg-white dark:text-slate-200 text-slate-700 border dark:border-slate-700/50 border-slate-200'
              }`}>
                {msg.role === 'assistant' && (
                  <p className="label-micro text-primary mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">auto_awesome</span>
                    InferScope Advisor
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

        {/* Suggested Questions */}
        {chatMessages.length === 0 && (
          <div className="px-6 pb-2 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="text-xs dark:text-slate-300 text-slate-600 border dark:border-slate-600 border-slate-300 px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t dark:border-slate-700/50 border-slate-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask follow-up..."
              className="flex-1 dark:bg-slate-800/60 bg-slate-100 border dark:border-slate-700 border-slate-300 rounded-lg px-4 py-2.5 text-sm dark:text-white text-slate-800 dark:placeholder-slate-500 placeholder-slate-400 outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => handleSend()}
              disabled={isChatLoading || !input.trim()}
              className="bg-primary text-on-primary p-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
