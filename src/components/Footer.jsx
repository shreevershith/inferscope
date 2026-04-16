export default function Footer() {
  return (
    <footer className="mt-16 border-t dark:border-slate-800 border-slate-200">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 py-6 flex items-center justify-center">
        <p className="text-[0.65rem] uppercase tracking-wider dark:text-slate-500 text-slate-500 font-bold">
          Data ·{' '}
          <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">OpenRouter</a>
          {' · '}
          <a href="https://lmsys.org/chatbot-arena" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">LMSYS Arena</a>
          {' · '}
          <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Groq</a>
        </p>
      </div>
    </footer>
  )
}
