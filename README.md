# InferScope

AI Model Intelligence Dashboard — compare LLMs, estimate inference costs, and explore infrastructure providers in one place.

**🔗 Live demo: [inferscope.vercel.app](https://inferscope.vercel.app/)**

## What This Dashboard Does

InferScope answers three questions every engineer building with LLMs faces:

1. **"Which model should I use?"** — The Model Arena tab aggregates benchmark scores, ELO ratings, pricing, and speed data from multiple public sources into a single sortable, filterable leaderboard.

2. **"What will it cost in production?"** — The Cost Calculator takes your model choice, token volumes, request rate, and caching strategy, then projects monthly and annual costs with interactive charts.

3. **"Where should I deploy?"** — The Infra Explorer compares 15 API inference providers and 10 self-hosted GPU configurations with side-by-side comparison tools.

The AI Advisor (powered by Groq) ties it all together — it sees your selected model, your calculator scenario, and live pricing data, so it gives recommendations grounded in your actual dashboard state.

---

## Features

### Tab 1: Model Arena

A live leaderboard ranking AI models by quality and cost-effectiveness.

**What each column means:**

| Column | Description | Source |
|--------|-------------|--------|
| **Rank** | Position based on Arena ELO score (descending) | Computed from LMSYS data |
| **Model Name** | The model's public identifier | OpenRouter + LMSYS |
| **Provider** | The company that built/hosts the model | OpenRouter API |
| **Arena ELO** | Skill rating from human blind A/B comparisons on LMSYS Chatbot Arena. Higher = better. Similar to chess ELO — a model with 1300 ELO will beat a 1200 ELO model ~64% of the time | LMSYS Arena (wulong.dev API) |
| **Quality** | Normalized 0-100 score derived from Arena ELO. Maps the ELO range 1100-1350 onto a percentage scale: `score = ((elo - 1100) / 250) * 100` | Computed |
| **Context** | Maximum input token window (e.g., 128K = 128,000 tokens). Determines how much text the model can process in a single request | OpenRouter API |
| **$/M Tokens** | Cost per 1 million input tokens. This is what providers charge to process your prompts | OpenRouter API |
| **Speed** | Output tokens generated per second (tok/s). Higher = faster responses | Seed data / Artificial Analysis |

**Filters:**
- **Provider** — Filter by model creator (OpenAI, Anthropic, Google, Meta, etc.)
- **License** — Open source vs proprietary
- **Focus Task** — Code, Reasoning, Chat, Creative. Filters to models whose `taskStrengths` array includes that category
- **Search** — Free-text search across model name and provider

**Sidebar panels:**
- **Arena Insight** — Bar chart showing the top 4 models by ELO, with a text summary
- **Optimization Tip** — Auto-generated suggestion comparing the #1 model's price to a cheaper alternative, showing potential savings percentage: `savings = ((top_price - cheap_price) / top_price) * 100`

**Model Comparison:** Select up to 3 models via checkboxes → a slide-up drawer shows a radar chart (Quality, Value, Speed, Context, Affordability) and a detailed metrics table with best-value highlights.

**Cross-tab flow:** Click "CALCULATE" on any row → the model's pricing auto-fills into the Cost Calculator tab.

---

### Tab 2: Cost Calculator

An interactive inference cost estimator that projects what running a model will cost at your scale.

**Inputs:**

| Input | Default | Description |
|-------|---------|-------------|
| Inference Model | (none) | Dropdown of all tracked models. Auto-populated when clicking "CALCULATE" from Model Arena |
| Input Tokens / Request | 500 | Average number of tokens in each prompt you send to the model |
| Output Tokens / Request | 200 | Average number of tokens the model generates per response |
| Requests / Day | 1,000 | How many API calls you expect per day |
| Cache Hit Rate | 30% | Percentage of input tokens served from cache (cached tokens cost ~90% less) |
| Traffic Profile | Base | Low (0.25x), Base (1x), or High (5x) multiplier on daily requests |

**How costs are calculated:**

```
Effective Requests/Day  = requestsPerDay * scenarioMultiplier
Requests/Month          = effectiveRequestsPerDay * 30

Total Input Tokens/Mo   = requestsPerMonth * inputTokensPerRequest
Total Output Tokens/Mo  = requestsPerMonth * outputTokensPerRequest

Cached Input Tokens     = totalInputTokens * (cacheHitRate / 100)
Uncached Input Tokens   = totalInputTokens * (1 - cacheHitRate / 100)

Input Cost              = (uncachedTokens / 1M) * inputPrice + (cachedTokens / 1M) * cachedPrice
Output Cost             = (totalOutputTokens / 1M) * outputPrice

Monthly Cost            = inputCost + outputCost
Cost per Request        = monthlyCost / requestsPerMonth
Annual Cost             = monthlyCost * 12
Cache Savings           = costWithoutCaching - monthlyCost
```

**Output metrics:**

| Metric | What it shows |
|--------|---------------|
| **Estimated Monthly Cost** | Total projected monthly spend based on current inputs |
| **Average Cost / Request** | Monthly cost divided by total requests. Below $0.01 is labeled "Efficiency: HIGH" |
| **Annual Expenditure** | Monthly cost * 12 |
| **Cached Monthly Savings** | Dollar amount saved by caching vs paying full price for all input tokens |

**Charts:**
- **Monthly Cost Distribution** — Horizontal stacked bar showing the split between input token cost and output token cost. Cached savings shown as a separate emerald label below the chart (rather than part of the stack, since savings aren't a cost component).
- **Cost vs Volume** — Line chart plotting monthly cost at 8 request volumes (100, 500, 1K, 5K, 10K, 25K, 50K, 100K requests/day). Uses a **log-scale X-axis** so the spacing between decades is proportional — avoiding the misleading "hockey-stick" artifact that appears when plotting a wide volume range on a linear axis.

**Metric cards** include optional trend chips ("Efficient ↑", "30% hit rate ↑") and source tags ("LIVE · OPENROUTER", "12-month projection") to ground each number in its origin.

**Real-time timestamps** — Shows when pricing data was last refreshed (e.g., "2m ago"), with a live pulse indicator.

**Debounced inputs** — Token-input fields use 300ms debounce before pushing to the store, preventing Recharts from re-rendering on every keystroke.

**Scenario multipliers:**

| Scenario | Request Multiplier | Use Case |
|----------|-------------------|----------|
| Low | 0.25x | Development, testing, low-traffic apps |
| Base | 1.0x | Production baseline |
| High | 5.0x | Peak traffic, batch processing, scaling projections |

---

### Tab 3: Infra Explorer

Compare API inference providers and self-hosted GPU options side-by-side.

**API Provider Cards** — 15 providers with key differentiators:

| Provider | Models | Price Range | Speed Tier | Differentiator |
|----------|--------|-------------|------------|----------------|
| Together AI | 200+ | $0.03 - $4.00/M | Fast | Open-source model hosting |
| Groq | 25 | $0.06 - $1.50/M | Ultra-fast | LPU hardware, lowest latency |
| AWS Bedrock | 40 | $0.25 - $15.00/M | Standard | Enterprise AWS integration |
| Replicate | 350+ | $0.05 - $3.50/M | Fast | Simple API for open models |
| OpenRouter | 300+ | $0 - $60.00/M | Varies | Unified API, best-price routing |
| Fireworks AI | 50 | $0.10 - $3.00/M | Fast | Optimized production inference |
| Anthropic | 8 | $0.25 - $15.00/M | Fast | Claude models, safety & reasoning |
| OpenAI | 15 | $0.15 - $60.00/M | Fast | GPT and o-series models |
| Google Vertex AI | 12 | $0.10 - $10.00/M | Fast | Gemini multimodal on GCP |
| Azure OpenAI | 12 | $0.50 - $60.00/M | Standard | Enterprise OpenAI on Azure |
| Hugging Face | 500+ | $0 - $5.00/M | Varies | Largest open-source model hub |
| DeepInfra | 80 | $0.04 - $2.00/M | Fast | Low-cost optimized inference |
| Perplexity | 5 | $0.20 - $3.00/M | Fast | Search-augmented models |
| Mistral AI | 6 | $0.10 - $4.00/M | Ultra-fast | European frontier models |
| Cohere | 8 | $0.15 - $3.00/M | Fast | RAG-optimized enterprise NLP |

**GPU Pricing Table** — 10 self-hosted GPU configurations for model deployment:

| GPU | VRAM | Provider | $/hr | Throughput | TFLOPS |
|-----|------|----------|------|------------|--------|
| H200 141GB | 141GB | CoreWeave | $4.25 | ~1200 tok/s | 1,979 |
| H100 80GB | 80GB | Lambda | $2.49 | ~800 tok/s | 989 |
| H100 80GB | 80GB | RunPod | $3.29 | ~800 tok/s | 989 |
| MI300X 192GB | 192GB | Lambda | $3.99 | ~900 tok/s | 1,307 |
| A100 80GB | 80GB | Lambda | $1.29 | ~400 tok/s | 312 |
| A100 80GB | 80GB | AWS | $3.06 | ~400 tok/s | 312 |
| L40S 48GB | 48GB | RunPod | $0.74 | ~250 tok/s | 366 |
| A10G 24GB | 24GB | AWS | $1.00 | ~150 tok/s | 125 |
| RTX 4090 24GB | 24GB | Vast.ai | $0.44 | ~180 tok/s | 330 |
| L4 24GB | 24GB | GCP | $0.60 | ~120 tok/s | 121 |

**GPU Comparison:** Select 2-3 GPUs via checkboxes → click "Compare Selected" → a slide-up drawer shows a radar chart (VRAM, Affordability, Throughput, Efficiency, Compute) and a detailed metrics table with best-value highlights (efficiency = tok/s per dollar, VRAM per dollar).

**Cross-tab flow:** Click "ESTIMATE COST" on any provider → navigates to Cost Calculator with that provider selected.

---

### AI Advisor (Slide-Out Panel)

A Groq-powered (Llama 3.3 70B) conversational assistant available from any tab via the floating sparkle button.

**Active Context Feed sidebar** — Instead of hiding context behind a chat prompt, a dedicated sidebar shows the user (and demonstrates trust) exactly what the AI can see:
- Selected Model with its input price
- Request Volume and scenario
- Cache Hit Rate
- Top-Ranked model by ELO

**Always-visible Suggested Questions** panel with seed prompts like "Best model under $500/mo", "RAG chatbot setup costs", "When should I use caching?". One click sends them as a chat message.

**Error UX** — Network/API failures render as distinct rose-tinted bubbles with an error icon, clearly separated from real AI responses.

**Example questions:**
- "What's the cheapest model for document extraction at scale?"
- "Compare Claude vs GPT for code generation"
- "I have a $500/month budget. What can I run?"
- "How does caching affect my costs?"

**Guardrails:**
- Scoped to AI/ML model selection and infrastructure topics
- User message and all context fields sanitized server-side before system-prompt interpolation (prevents prompt injection)
- API key never exposed to the browser (proxied through Vercel serverless / Vite dev middleware)
- Only mounted in the DOM when open (saves 8 idle Zustand subscriptions)

---

### Hero Banner

A persistent banner below the header showing:
- **AI Model Intelligence** headline with tagline
- **Live stat chips** — Models Tracked, Providers monitored, Last Refreshed timestamp (real, from data fetch)

---

### Contextual Workflow Tour

Instead of a single onboarding modal that dumps everything on you at once, InferScope uses **section-scoped chapters** that fire the first time a user enters each part of the app. Each chapter is independently gated by its own localStorage flag.

| Chapter | Auto-trigger | Steps | What it teaches |
|---------|-------------|-------|-----------------|
| **A — Arena Intro** | First app load | 7 | Welcome → tabs → leaderboard → filters → Value column → Compare → Arena Insight |
| **B — Calculator** | First time on Cost Calculator tab | 3 | Inputs panel → metric cards → charts |
| **C — Infra Explorer** | First time on Infra Explorer tab | 3 | Provider cards → GPU pricing → Compare column |
| **D — AI Advisor** | First time advisor panel opens | 2 | Context badges → suggested questions input |

**Spotlight-style UI** — on desktop, a gold ring highlights the exact element being explained with the rest of the page dimmed via a 9999px outer box-shadow trick (no SVG masks). The tooltip card auto-positions top / bottom / left / right relative to the target, clamped to the viewport.

**Mobile bottom sheet** — on screens <768px, the spotlight stays on the element but the tooltip docks to the bottom of the screen so it never overlaps. Targets auto-scroll to `start` alignment so they stay visible above the sheet.

**Keyboard nav** — `Esc` skips, `←` / `→` step backward/forward.

**Re-trigger anytime** — Header has a "Take Tour" dropdown (graduation-cap icon) that lets users replay any chapter on demand. The dropdown auto-navigates to the right tab (and opens the advisor panel for chapter D) before starting.

---

### Analytics & Engagement Tracking

InferScope ships with **Google Analytics 4** wired up for meaningful engagement tracking — not just page views.

**Privacy-first loading:**
- GA script does **not** load until the user accepts the cookie consent banner on first visit.
- Before consent, custom events are queued in memory and flushed on grant.
- Decline → GA never loads for that session, queued events are dropped.
- No ID configured (or placeholder) → the entire analytics module silently no-ops. Safe for dev.
- `anonymize_ip` enabled; event param values are sanitized to GA4 length limits (key ≤40 chars, string value ≤100 chars).

**Events tracked** (beyond automatic `page_view`):

| Category | Events | Params |
|----------|--------|--------|
| Navigation | `tab_switch`, `theme_toggle` | `tab_name`, `mode` |
| Model Arena | `model_select`, `filter_apply`, `compare_open`, `arena_insight_view`, `calculate_from_arena` | `model_id`, `model_name`, `filter_type`, `value`, `view`, `model_count` |
| Cost Calculator | `calculator_scenario_change` | `scenario` |
| Infra Explorer | `provider_estimate_cost`, `gpu_compare_open` | `provider`, `gpu_count` |
| AI Advisor | `advisor_open`, `advisor_message_sent`, `advisor_suggested_click` | `message_length`, `question` |
| Tour | `tour_chapter_start` (auto/manual), `tour_chapter_complete`, `tour_chapter_skip` | `chapter`, `source`, `step_index` |

**Consent banner** — Appears 1.5s after first paint (so it doesn't race the tour), bottom-right on desktop, bottom-full-width on mobile. Preference stored in `localStorage` (`inferscope-analytics-consent`). Returning users don't see it again.

**To activate in your own deploy:**
1. Create a GA4 property at [analytics.google.com](https://analytics.google.com)
2. Copy the measurement ID (format `G-XXXXXXXXXX`)
3. Add it to `.env.local` as `VITE_GA_MEASUREMENT_ID=G-YOUR-ID`
4. For production: add the same variable to Vercel → Settings → Environment Variables

**Dashboard setup (what to do inside GA):** see [`GA_SETUP.md`](./GA_SETUP.md) for the full one-time checklist — marking conversions, registering custom dimensions, building the core funnel, and a weekly-metrics guide.

---

## Cross-Tab Data Flows

```
Flow 1: Model Arena → Cost Calculator
  User clicks "CALCULATE" on a model row
    └─ applyModelToCalculator({ id, name, pricing }) in Zustand store
         └─ Cost Calculator auto-fills model name + input/output pricing
              └─ All cost metrics recompute via useMemo

Flow 2: Infra Explorer → Cost Calculator
  User clicks "ESTIMATE COST" on a provider card
    └─ applyProviderToCalculator(provider) in Zustand store
         └─ Navigates to Cost Calculator tab with provider context

Flow 3: Any Tab → AI Advisor
  User opens advisor panel and sends a message
    └─ getAdvisorContext() aggregates state from all slices
         └─ Context sent with every Groq API request
              └─ AI response references live dashboard data
```

---

## Architecture

### State Management (Zustand)

5 slices with `subscribeWithSelector` middleware to prevent cross-tab re-renders:

| Slice | State | Purpose |
|-------|-------|---------|
| **models** | `modelList[]`, `modelsLoading`, `modelsLastFetched` | Merged model data from all API sources |
| **pricing** | `pricingMap{}`, `providers[]` | Per-model pricing details |
| **calculator** | `calculatorInputs{}`, `selectedProvider`, `scenario` | All cost calculator parameters |
| **advisor** | `chatMessages[]`, `isChatLoading`, `isPanelOpen` | AI chat state |
| **ui** | `theme`, `activeTab`, `compareModels[]` | UI preferences |

### Data Fetching (SWR)

| Source | Cache Duration | Dedup Interval | Rationale |
|--------|---------------|----------------|-----------|
| OpenRouter models | 1 hour | 15 min | Prices change infrequently |
| LMSYS Arena | 1 hour | 15 min | ELO updates daily |
| Seed data | Instant (bundled) | N/A | Fallback when APIs unavailable |

### Data Normalization

All API responses are merged into a unified `Model` shape:

```js
{
  id: "claude-3-5-sonnet",
  name: "Claude 3.5 Sonnet",
  provider: "Anthropic",
  arenaElo: 1288,           // from LMSYS Arena
  qualityScore: 75,          // computed: ((elo - 1100) / 250) * 100
  inputPricePerMToken: 3.00, // from OpenRouter ($/M input tokens)
  outputPricePerMToken: 15.00,
  cachedInputPrice: 0.30,    // ~10% of input price
  tokensPerSecond: 74,
  contextWindow: 200000,
  contextLabel: "200K",
  license: "proprietary",
  modalities: ["text", "vision"],
  taskStrengths: ["code", "reasoning", "chat"]
}
```

Priority: Arena ELO > OpenRouter pricing > bundled seed defaults.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | React 18 + Vite 5 | Fast HMR, clean SPA output |
| Styling | Tailwind CSS 3 | Precision Slate design tokens |
| State | Zustand (subscribeWithSelector) | Selector subscriptions prevent re-renders across tabs |
| Data Fetching | SWR | Stale-while-revalidate, request deduplication |
| Charts | Recharts | Declarative, composable, lightweight |
| UI Components | Headless UI | Accessible tab management |
| Icons | Material Symbols Outlined | Consistent icon set |
| AI Backend | Groq API (Llama 3.3 70B) | Free tier, ultra-fast inference, OpenAI-compatible |
| Analytics | Google Analytics 4 (gtag.js) | Consent-gated, custom event tracking, zero-cost |
| Deployment | Vercel | Serverless functions for API proxy |

---

## Design System: Precision Slate

Designed in Google Stitch. The "Digital Observatory" aesthetic.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f172a` | Deep navy page background |
| Card surface | `#1e293b` | Dark slate for cards and panels |
| Primary accent | `#ffe188` | Warm gold for highlights, CTAs, active states |
| On-primary | `#453a00` | Dark text on gold buttons |
| On-surface | `#f8f9fa` | Near-white body text |
| Muted text | `slate-400` | Secondary labels, metadata |
| Error | `#ff7351` | Error states |

**Rules:** No 1px borders (use background color shifts). Glassmorphism for floating elements. Inter font throughout. Dark mode is default. Brand glow animation on logo. Live pulse indicators for data freshness.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
git clone <your-repo-url>
cd inferscope
npm install
```

### Environment Setup

Copy the template to `.env.local` (gitignored) and fill in your real values:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```
# Required for AI Advisor. Free at https://console.groq.com
GROQ_API_KEY=gsk_your_real_key_here

# Optional — enables Google Analytics. Leave as placeholder to disable.
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

> **Note on env file precedence:** Vite's load order is `.env.local` > `.env` > baked defaults. The repo commits only `.env.local.example` (the template). Your real `.env.local` stays on your machine only — it's gitignored by the `*.local` pattern.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server includes a built-in API proxy that routes `/api/ai-chat` to Groq, so the AI Advisor works locally without Vercel.

### Building for Production

```bash
npm run build
npm run preview
```

### Deploy to Vercel

The current production deployment lives at **[inferscope.vercel.app](https://inferscope.vercel.app/)**.

To deploy your own:

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add environment variables in project Settings → Environment Variables (Production scope):
   - `GROQ_API_KEY` — your Groq API key (required for AI Advisor)
   - `VITE_GA_MEASUREMENT_ID` — your GA4 measurement ID (optional, enables analytics)
   - `ALLOWED_ORIGIN` — your production domain (optional, hardens CORS)
4. Deploy

The `api/ai-chat.js` serverless function handles AI requests in production with built-in rate limiting (10 req/min per IP) and prompt-injection-safe context sanitization.

---

## Project Structure

```
inferscope/
├── api/
│   └── ai-chat.js              # Vercel serverless — Groq proxy with input sanitization
├── src/
│   ├── App.jsx                  # 3-tab shell + hero banner + theme toggle + AI Advisor FAB + welcome tour + footer
│   ├── store/dashboardStore.js  # Zustand (5 slices, cross-tab actions)
│   ├── constants/
│   │   ├── modelDefaults.js     # 8 seed models with full metadata
│   │   ├── providerMetadata.js  # 15 API providers + 10 GPU pricing entries
│   │   └── taskCategories.js    # Task filters + scenario multipliers
│   ├── lib/
│   │   ├── costCalc.js          # Pure functions: calculateCosts, volumeCurve, scenarios
│   │   ├── openRouterClient.js  # OpenRouter /api/v1/models fetch + normalize
│   │   ├── arenaClient.js       # LMSYS Arena leaderboard fetch + normalize
│   │   ├── dataNormalizer.js    # Merge multi-source data into unified Model shape
│   │   ├── aiClient.js          # POST /api/ai-chat wrapper with sanitization
│   │   ├── timeUtils.js         # Relative timestamp formatting (e.g., "2m ago")
│   │   ├── analytics.js         # GA4 integration + custom event helpers (consent-gated)
│   │   └── tourTriggers.js      # Per-chapter localStorage flags + auto-trigger logic
│   ├── hooks/
│   │   ├── useModelData.js      # SWR hook — fetches + merges all model data
│   │   └── useCostCalculator.js # useMemo — reactive cost computation
│   ├── components/
│   │   ├── HeroBanner.jsx       # Live stats banner (models tracked, providers, last refresh)
│   │   ├── WelcomeTour.jsx      # Contextual 4-chapter workflow tour with spotlight engine
│   │   ├── ConsentBanner.jsx    # Cookie consent banner (gates GA loading)
│   │   ├── Footer.jsx           # Data source attribution footer
│   │   ├── ui/
│   │   │   ├── MetricCard.jsx   # KPI card with tooltip, trend chips, source tags
│   │   │   ├── InfoTooltip.jsx  # Hover/click educational tooltip
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── SkeletonCard.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   └── advisor/
│   │       └── AdvisorPanel.jsx # Slide-out AI chat with Active Context Feed sidebar
│   └── tabs/
│       ├── ModelArena/
│       │   ├── index.jsx            # Leaderboard, filters, Arena Insight sidebar
│       │   ├── ArenaInsight.jsx     # Interactive bar chart sidebar
│       │   └── ModelCompareDrawer.jsx # Model comparison drawer (radar + table)
│       ├── CostCalculator/index.jsx # Inputs, metric cards, cost charts
│       └── InfraExplorer/
│           ├── index.jsx            # Provider cards, GPU pricing table
│           └── GpuCompareDrawer.jsx # GPU comparison drawer (radar + table)
├── DESIGN.md                    # Precision Slate design system (from Stitch)
├── CLAUDE.md                    # Claude Code instructions
├── tailwind.config.js           # Design tokens mapped to Tailwind
├── vite.config.js               # Dev server + Groq API proxy plugin
└── vercel.json                  # SPA fallback routing
```

---

## Security

- **API key isolation** — `GROQ_API_KEY` lives in `.env.local` (gitignored), never in client-side code. Proxied through Vercel serverless / Vite dev middleware.
- **Prompt injection defense** — All `context` fields (top models, calculator scenario, selected provider) are sanitized server-side before being interpolated into the system prompt. Patterns like "ignore previous instructions" are redacted, non-printable chars stripped, lengths capped per field. Applied in both `api/ai-chat.js` and the Vite dev proxy.
- **Input sanitization** — User messages stripped of non-printable characters, capped at 500 chars (both client and server).
- **Rate limiting** — In-memory IP-based rate limiter: 10 req/min in production, 30 req/min in dev. Returns `429` with a user-safe retry message.
- **Body size caps** — Request bodies are capped (4KB production, 8KB dev) to prevent memory-abuse attacks.
- **CORS hardening** — Set `ALLOWED_ORIGIN` env var to restrict the API to your production domain.
- **Generic error messages** — API errors return user-safe messages; internal details (hostnames, stack traces) are logged server-side only, never leaked to clients.
- **Response validation** — External API responses (OpenRouter, LMSYS Arena) are shape-checked and timeouts enforced via `AbortController` (10s). Malformed individual entries are dropped rather than crashing the whole batch.
- **NaN firewall** — All numeric calculator inputs are coerced to finite non-negative numbers before arithmetic. `cachingHitRate` is clamped to [0, 100]. Guarantees no `NaN` or `Infinity` leaks into the UI.
- **Error boundary** — App-level React error boundary catches render crashes with recovery UI.
- **Consent-gated analytics** — Google Analytics script is never injected until the user explicitly accepts the consent banner. No cookies set before consent. Declining preserves zero tracking for the session.

## License

MIT
