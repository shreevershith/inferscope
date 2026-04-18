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
- 3 tabs: Model Arena, Cost Calculator, Infra Explorer
- Persistent AI Advisor slide-out side panel (Groq-powered)
- Zustand store with subscribeWithSelector middleware (models, pricing, calculator, advisor, ui, tour slices)
- SWR hooks for API data with stale-while-revalidate caching
- Vercel serverless functions for AI chat proxy (`api/ai-chat.js`)
- Vite dev plugin mirrors the serverless function locally (`vite.config.js`)

## Contextual Workflow Tour
- Spotlight engine in `src/components/WelcomeTour.jsx`
- 4 chapters (A: Arena, B: Calculator, C: Infra, D: Advisor), each with its own localStorage flag
- Auto-fires on first visit to each section; "Take Tour" menu in header for manual re-trigger
- Mobile (<768px) uses bottom-sheet tooltip instead of positioned card
- Keyboard nav: Esc / ← / →

## Analytics
- `src/lib/analytics.js` — GA4 integration + consent-gated event tracking
- GA script loads only after user accepts the consent banner
- Events queued in memory before consent, flushed on grant
- Namespaced event helpers in `events` object — import and call like `events.tabSwitch('Model Arena')`
- When adding new user actions, add a corresponding event in `analytics.js` and call it from the UI

## Environment
- `.env.local.example` is the committed template (tracked in git)
- Real values live in `.env.local` (gitignored via `*.local` pattern)
- Contributor workflow: `cp .env.local.example .env.local` then fill in keys
- Required: `GROQ_API_KEY`
- Optional: `VITE_GA_MEASUREMENT_ID`, `ALLOWED_ORIGIN`

## Security Conventions
- Never expose API keys to the client
- Always sanitize user input before interpolating into AI system prompts (see `sanitizeContextField` in `api/ai-chat.js`)
- Use `AbortController` with 10s timeout on external API fetches
- Rate-limit serverless endpoints in-memory (10 req/min per IP)
- All numeric calculator inputs must be coerced to finite non-negative numbers
