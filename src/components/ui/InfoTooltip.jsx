import { useState } from 'react'

export default function InfoTooltip({ text, children }) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      {children}
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="ml-1.5 text-slate-500 hover:text-primary transition-colors"
        aria-label="More information"
      >
        <span className="material-symbols-outlined text-sm">info</span>
      </button>
      {show && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 rounded-lg px-3 py-2 text-xs dark:text-slate-300 text-slate-600 shadow-xl z-50 leading-relaxed">
          {text}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-2 h-2 dark:bg-slate-900 bg-white border-l dark:border-slate-700 border-slate-200 border-t rotate-45 mt-1" />
        </div>
      )}
    </span>
  )
}
