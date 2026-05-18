# InferScope — AI Model Intelligence Dashboard

## Design System
This project uses a design system defined in DESIGN.md ("Precision Slate" / "The Luminescent Precision").
Always refer to DESIGN.md when generating or modifying any UI component.

### Key Rules
- Use only colors, fonts, and spacing values defined in DESIGN.md
- Do not invent new color values — use the Precision Slate palette
- Follow the "No-Line Rule": no 1px borders; use background color shifts for boundaries
- Use Inter font family throughout
- Dark mode is the default and primary theme
- Follow the glassmorphism rules for floating elements

### Color Quick Reference (from Stitch export)
- Background: #0f172a (deep navy)
- Card surfaces: #1e293b (dark slate)
- Primary accent: #ffe188 / #ffe084 (warm gold)
- On-primary text: #453a00 (dark gold)
- On-surface text: #f8f9fa (near-white)
- Muted text: slate-400
- Borders: slate-700/30 or slate-700/50

### Component Patterns
- Stat cards: border-l-4 with primary accent
- Tables: no alternating rows, generous whitespace
- Buttons: gold outline or solid gold with dark text
- Glow effect: box-shadow with primary color at low opacity

## Tech Stack
- React 18 + Vite 5
- Tailwind CSS v3
- Zustand (state management, subscribeWithSelector middleware)
- SWR (data fetching with stale-while-revalidate)
- Recharts (charts)
- Headless UI (tabs, transitions)
- Material Symbols Outlined (icons)
- Google Analytics 4 via gtag.js (consent-gated)
- Groq API (Llama 3.3 70B) for AI Advisor

## Architecture
- 3 tabs: Model Arena, Cost Calculator, Infra Explorer — all lazy-loaded via `React.lazy` + `Suspense`
- Persistent AI Advisor slide-out side panel (Groq-powered), also lazy-loaded
- Zustand store with subscribeWithSelector middleware (6 slices: models, pricing, calculator, advisor, ui, tour). Atomic field selectors throughout — never subscribe to the whole `calculatorInputs` object when only a few fields are read
- SWR hooks for API data with stale-while-revalidate caching, plus per-hook `localStorage` disk cache (24h TTL each) for fast first paint:
  - `inferscope-models-cache-v3` — model list (OpenRouter + Arena merge)
  - `inferscope-gpu-pricing-cache-v1` — GPU offers (Vast.ai)
- Cache key version suffix bumps when payload shape changes — invalidates stale-shape caches automatically. History documented inline in `useModelData.js`
- Vercel serverless functions: `api/ai-chat.js` (Groq proxy) and `api/gpu-pricing.js` (Vast.ai bundles aggregator with p25/median/p75, 1h edge cache, CORS-gated)
- Vite dev plugin mirrors both serverless functions locally (`vite.config.js`)
- Every lazy chunk is wrapped in `ErrorBoundary` (the tab boundary is keyed to `activeTab` so a crash clears when switching tabs)

## Live data sources (no hardcoded business data)
- **Model catalog + pricing**: OpenRouter `/api/v1/models` (~350 models) via `src/lib/openRouterClient.js` + `useModelData`. Names have OpenRouter's "Provider: " prefix stripped at normalization. Variable-price routers flagged with `isVariablePrice: true`
- **Arena ELO**: arena-ai-leaderboards proxy (wulong.dev). 5 boards fetched in parallel: `text + code + vision + document + search`. **Z-score-normalized per board** before merging so boards with different distributions compete fairly. Highest z wins per model, mapped back to a synthetic ELO using the text board's mean+stddev. See `src/lib/arenaClient.js`
- **API provider catalog**: `deriveProviders(modelList)` in `src/constants/providerMetadata.js` — derived from live OpenRouter response (counts, price ranges, top ELO per provider). 50+ canonical name mappings (`anthracite-org` → "Anthracite", `aion-labs` → "Aion Labs", etc.). Providers with < 3 models are folded into a "niche" group at render time
- **GPU pricing**: Vast.ai public bundles API via `api/gpu-pricing.js` → `src/lib/gpuPricingClient.js` → `src/hooks/useGpuPricing.js`. Returns p25/median/p75 band, not just median
- Fallbacks: `FALLBACK_MODELS` (1-row sentinel) and `getProviderVisual()` (UI icons/URLs only) are the only static data — no hardcoded model/provider/GPU lists exist
- "Speed" column was removed (no public per-model tokens/sec API exists) and replaced with "Output $/M". Quality formula is `((elo − 1100) / 500) * 100` clamped to [0, 100] — band widened from `/300` so top-tier models differentiate instead of clamping to 100
- Cost-vs-Volume chart uses `getAdaptiveVolumeTicks()` log-spaced around the user's current `requestsPerDay` (factors 0.01× → 30×)

## Tabs in detail
- **Model Arena**: fuzzy 3-tier search (exact > substring > Damerau-Levenshtein, debounced 200ms), CSV export, alphabetically-sorted provider filter, cycling 7-generator optimization tips in sidebar (auto-rotate 12s)
- **Cost Calculator**: auto-selects top priced model on first load; smart use-case-aware token defaults (reasoning/code/creative/chat/RAG-style); Spike scenario (20×) plus tunable inline multipliers per scenario; **Workload Recommendation panel** Pareto-ranks top 3 models for the current inputs (`score = qualityScore − 30 × log10(monthlyCost + 1)`)
- **Infra Explorer**: live providers folded into primary (≥3 models) + niche (collapsed); GPU table shows best price + p25–p75 band; section-level amber notice when Vast.ai fails but cache exists
- **AI Advisor**: structured 3-part answers (Recommendation / Why / Trade-off), personalized suggested questions (7 dynamic generators in `src/lib/advisorPrompts.js`), Active Context Feed includes Projected Cost

## Contextual Workflow Tour
- Spotlight engine in `src/components/WelcomeTour.jsx`
- 4 chapters (A: Arena, B: Calculator, C: Infra, D: Advisor), each with its own localStorage flag
- Auto-fires on first visit to each section; "Take Tour" menu in header for manual re-trigger
- Mobile (<768px) uses bottom-sheet tooltip instead of positioned card
- Keyboard nav: Esc / ← / →

## Analytics
- `src/lib/telemetry.js` — GA4 integration + consent-gated event tracking
- GA script loads only after user accepts the consent banner
- Events queued in memory before consent, flushed on grant
- Namespaced event helpers in `events` object — import and call like `events.tabSwitch('Model Arena')`
- When adding new user actions, add a corresponding event in `telemetry.js` and call it from the UI
- The file is named `telemetry.js` (not `analytics.js`) intentionally — ad blockers like uBlock Origin block `*analytics*.js` requests with `ERR_BLOCKED_BY_CLIENT`, which would kill the entire app since it's imported at the root. Do not rename it back

## Environment
- `.env.local.example` is the committed template (tracked in git)
- Real values live in `.env.local` (gitignored via `*.local` pattern)
- Contributor workflow: `cp .env.local.example .env.local` then fill in keys
- Required: `GROQ_API_KEY`
- Optional: `VITE_GA_MEASUREMENT_ID`, `ALLOWED_ORIGIN`

## Error UX hierarchy (3 tiers)
Same failure mode → matched scope of presentation. Don't add a 4th pattern.
- **App-level (catastrophic)**: `StaleCacheBanner` at top of page when both model upstreams fail AND cache is showing
- **Section-level**: amber notice scoped inside one section (e.g. Infra Explorer when only Vast.ai is down)
- **Action-level**: inline rose-tinted error bubble inside the failing action (AdvisorPanel chat)

`useModelData` and `useGpuPricing` both return the same error contract: `{ data, error, sourceErrors, fromCache, hasPartialFailure, hasTotalFailure }`. Consumers branch on `hasTotalFailure` vs `hasPartialFailure + fromCache`.

## Security Conventions
- Never expose API keys to the client. No `VITE_*` prefix on `GROQ_API_KEY`
- Always sanitize user input before interpolating into AI system prompts (see `sanitizeContextField` in `api/ai-chat.js`)
- Use `AbortController` with timeout on every external fetch — 10s for upstreams, 30s for Groq (longer first-response latency on cold models)
- Rate-limit serverless endpoints in-memory (10 req/min per IP on ai-chat). Trust `x-real-ip` first, rightmost of `x-forwarded-for` second — never the leftmost (spoofable)
- Apply the same `ALLOWED_ORIGIN` CORS gate to **every** `/api/*` endpoint, not just ai-chat
- All numeric calculator inputs must be coerced to finite non-negative numbers via `safeNum`
- Optimization-tip generators must use the `ratio(num, den)` helper for any division — guarantees no NaN reaches the DOM
- Shape-check every upstream response (OpenRouter, Arena, Vast.ai). Drop malformed individual entries rather than failing the batch. Throttle normalization warnings to ~3 per session
- Throw typed `AiClientError` with `.source` from API client wrappers — never throw bare `Error` for network/timeout/parse issues; the UI classifies by `.source`
- Wrap every lazy-loaded component in `ErrorBoundary` (not just `Suspense`). A failed chunk fetch should never white-screen the app

## Never reintroduce hardcoded business data
- Don't hardcode model lists, pricing, ELO, GPU specs, or provider catalogs
- New providers/models should appear automatically as upstreams update — only `PROVIDER_VISUALS` (icons/URLs) and `PROVIDER_PRETTIFIED_NAMES` (slug → display name) in `providerMetadata.js` + `openRouterClient.js` are static UI metadata, not business data
- If a needed data source has no public API, prefer an honest `—` over made-up numbers (see how the Speed column was handled)
- The `telemetry.js` file is named that way to dodge ad-blocker filters — do NOT rename it back to `analytics.js`. Ad blockers match `*analytics*.js` and would prevent the entire app from booting since it's imported at the root
