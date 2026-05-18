// Google Analytics 4 + lightweight event tracking for InferScope.
//
// Design notes:
// - GA script is loaded ONLY after user grants consent (see ConsentBanner).
// - Before consent, track() calls are queued and flushed on grant.
// - Measurement ID is read from Vite env var VITE_GA_MEASUREMENT_ID.
//   (Prefix VITE_ is required for Vite to expose to client code.)
// - If ID is missing or starts with 'G-XXXX' (placeholder), we silently no-op.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const CONSENT_KEY = 'inferscope-analytics-consent'
const DEBUG = import.meta.env.DEV

let gaLoaded = false
let consentGranted = false
const eventQueue = []

function isValidId(id) {
  return typeof id === 'string' && id.startsWith('G-') && !id.includes('XXXX') && id.length > 3
}

export function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted'
  } catch {
    return false
  }
}

export function hasDeclined() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'declined'
  } catch {
    return false
  }
}

export function consentStatus() {
  try {
    return localStorage.getItem(CONSENT_KEY) // 'granted' | 'declined' | null
  } catch {
    return null
  }
}

// Load the GA script tag exactly once (after consent).
function loadGAScript() {
  if (gaLoaded || !isValidId(MEASUREMENT_ID)) return
  gaLoaded = true

  // Inject gtag.js
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  // Bootstrap dataLayer + gtag fn
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: true,
    anonymize_ip: true,  // light privacy hygiene
  })

  if (DEBUG) console.info('[analytics] GA4 loaded with ID', MEASUREMENT_ID)
}

// Grant consent → load GA, flush queued events.
export function grantConsent() {
  try { localStorage.setItem(CONSENT_KEY, 'granted') } catch {}
  consentGranted = true
  loadGAScript()
  flushQueue()
}

export function declineConsent() {
  try { localStorage.setItem(CONSENT_KEY, 'declined') } catch {}
  consentGranted = false
  eventQueue.length = 0  // drop queued events
}

// Initialize on page load if consent already granted previously.
export function initAnalytics() {
  if (hasConsent()) {
    consentGranted = true
    loadGAScript()
    flushQueue()
  }
  if (DEBUG && !isValidId(MEASUREMENT_ID)) {
    console.info('[analytics] VITE_GA_MEASUREMENT_ID not set or is placeholder — tracking disabled')
  }
}

function flushQueue() {
  while (eventQueue.length) {
    const [name, params] = eventQueue.shift()
    sendEvent(name, params)
  }
}

function sendEvent(name, params) {
  if (typeof window.gtag !== 'function') return
  try {
    window.gtag('event', name, params || {})
    if (DEBUG) console.info('[analytics]', name, params || {})
  } catch (err) {
    if (DEBUG) console.warn('[analytics] event failed', err)
  }
}

// Public event helper. Queues if consent not yet granted.
export function track(eventName, params = {}) {
  // Always sanitize param values (GA4 limits: key ≤40 chars, string val ≤100 chars)
  const clean = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue
    const key = String(k).slice(0, 40)
    const val = typeof v === 'string' ? v.slice(0, 100) : v
    clean[key] = val
  }

  if (!consentGranted || !gaLoaded) {
    eventQueue.push([eventName, clean])
    return
  }
  sendEvent(eventName, clean)
}

// Namespaced event names for readability + consistency
export const events = {
  // Navigation
  tabSwitch: (tabName) => track('tab_switch', { tab_name: tabName }),
  themeToggle: (mode) => track('theme_toggle', { mode }),

  // Model Arena
  modelSelect: (modelId, modelName, source) => track('model_select', { model_id: modelId, model_name: modelName, source }),
  filterApply: (filterType, value) => track('filter_apply', { filter_type: filterType, value: String(value) }),
  compareOpen: (modelCount) => track('compare_open', { model_count: modelCount }),
  arenaInsightView: (view) => track('arena_insight_view', { view }),

  // Cost Calculator
  calculatorScenario: (scenario) => track('calculator_scenario_change', { scenario }),
  calculateFromArena: (modelName) => track('calculate_from_arena', { model_name: modelName }),

  // Infra Explorer
  providerEstimateCost: (providerName) => track('provider_estimate_cost', { provider: providerName }),
  gpuCompareOpen: (gpuCount) => track('gpu_compare_open', { gpu_count: gpuCount }),

  // AI Advisor
  advisorOpen: () => track('advisor_open'),
  advisorMessageSent: (messageLength) => track('advisor_message_sent', { message_length: messageLength }),
  advisorSuggestedClick: (question) => track('advisor_suggested_click', { question }),

  // Tour
  tourChapterStart: (chapter, source) => track('tour_chapter_start', { chapter, source }),  // source: 'auto' | 'manual'
  tourChapterComplete: (chapter) => track('tour_chapter_complete', { chapter }),
  tourChapterSkip: (chapter, stepIndex) => track('tour_chapter_skip', { chapter, step_index: stepIndex }),

  // External links
  externalLink: (url, context) => track('external_link_click', { url, context }),
}
