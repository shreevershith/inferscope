import { useEffect, useState } from 'react'
import { consentStatus, grantConsent, declineConsent } from '../lib/telemetry'

/**
 * Minimal cookie consent banner (bottom of screen).
 * - Only shows if user hasn't already granted or declined
 * - Stores preference in localStorage via analytics module
 * - Accept → GA script loads immediately + queued events flush
 * - Decline → GA never loads this session, any queued events dropped
 */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Delay so we don't compete with the tour modal on first paint
    const t = setTimeout(() => {
      if (consentStatus() === null) setVisible(true)
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const handleAccept = () => {
    grantConsent()
    setVisible(false)
  }

  const handleDecline = () => {
    declineConsent()
    setVisible(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[60] pointer-events-none animate-slideUp">
      <div className="dark:bg-dash-card bg-white dark:shadow-2xl shadow-xl border dark:border-slate-700/50 border-slate-200 rounded-2xl p-5 pointer-events-auto">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary">cookie</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold dark:text-white text-slate-800 text-sm mb-1">Help us improve InferScope</h3>
            <p className="text-xs dark:text-slate-400 text-slate-600 leading-relaxed">
              We use cookies for privacy-friendly analytics — page views, tab usage, and feature engagement.
              No personal data, no tracking across sites. You can opt out anytime.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleDecline}
            className="text-xs font-bold dark:text-slate-400 text-slate-500 hover:text-primary transition-colors px-3 py-2"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="text-[0.7rem] font-black tracking-widest uppercase bg-primary text-on-primary px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-[0_0_16px_rgba(255,225,136,0.25)]"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
