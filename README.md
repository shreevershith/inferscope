# InferScope

AI Model Intelligence Dashboard — compare LLMs, estimate inference costs, and explore infrastructure providers in one place.

## What This Dashboard Does

InferScope answers two questions every engineer building with LLMs faces:

1. **"Which model should I use?"** — The Model Arena tab aggregates benchmark scores, ELO ratings, pricing, and speed data from multiple public sources into a single sortable, filterable leaderboard.

2. **"What will it cost in production?"** — The Cost Calculator takes your model choice, token volumes, request rate, and caching strategy, then projects monthly and annual costs with interactive charts.

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
- **Monthly Cost Distribution** — Stacked bar showing the split between input token cost, output token cost, and caching savings
- **Cost vs Volume** — Line chart plotting monthly cost at 8 request volumes (100, 500, 1K, 5K, 10K, 25K, 50K, 100K requests/day) to visualize how costs scale

**Scenario multipliers:**

| Scenario | Request Multiplier | Use Case |
|----------|-------------------|----------|
| Low | 0.25x | Development, testing, low-traffic apps |
| Base | 1.0x | Production baseline |
| High | 5.0x | Peak traffic, batch processing, scaling projections |

---

### Tab 3: Infra Explorer

Compare API inference providers and self-hosted GPU options.

**API Provider Cards** — 6 providers with key differentiators:

| Provider | Models | Price Range | Speed Tier | Differentiator |
|----------|--------|-------------|------------|----------------|
| Together AI | 200+ | $0.03 - $4.00/M | Fast | Open-source model hosting |
| Groq | 25 | $0.06 - $1.50/M | Ultra-fast | LPU hardware, lowest latency |
| AWS Bedrock | 40 | $0.25 - $15.00/M | Standard | Enterprise AWS integration |
| Replicate | 350+ | $0.05 - $3.50/M | Fast | Simple API for open models |
| OpenRouter | 300+ | $0 - $60.00/M | Varies | Unified API, best-price routing |
| Fireworks AI | 50 | $0.10 - $3.00/M | Fast | Optimized production inference |

**GPU Pricing Table** — For self-hosted model deployment:

| GPU | VRAM | Provider | $/hr | Throughput |
|-----|------|----------|------|------------|
| H100 80GB | 80GB | Lambda | $2.49 | ~800 tok/s |
| H100 80GB | 80GB | RunPod | $3.29 | ~800 tok/s |
| A100 80GB | 80GB | Lambda | $1.29 | ~400 tok/s |
| A100 80GB | 80GB | AWS | $3.06 | ~400 tok/s |
| L40S 48GB | 48GB | RunPod | $0.74 | ~250 tok/s |

**Cross-tab flow:** Click "ESTIMATE COST" on any provider → navigates to Cost Calculator with that provider selected.

---

### AI Advisor (Persistent Side Panel)

A Groq-powered (Llama 3.3 70B) conversational assistant available from any tab via the floating sparkle button.

**What it knows (context injected per message):**
- Top 10 models from the Arena leaderboard with ELO scores and pricing
- Your currently selected model (if any)
- Your Cost Calculator scenario (model, request volume, caching rate, projected cost)
- Selected infrastructure provider

**Example questions:**
- "What's the cheapest model for document extraction at scale?"
- "Compare Claude vs GPT for code generation"
- "I have a $500/month budget. What can I run?"
- "How does caching affect my costs?"

**Guardrails:**
- Scoped to AI/ML model selection and infrastructure topics
- Input sanitized and capped at 500 characters
- API key never exposed to the browser (proxied through Vercel serverless / Vite dev middleware)

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

**Rules:** No 1px borders (use background color shifts). Glassmorphism for floating elements. Inter font throughout. Dark mode is default.

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

Create a `.env.local` file in the project root:

```
GROQ_API_KEY=your_groq_api_key_here
```

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

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `GROQ_API_KEY` as an environment variable in project settings
4. Deploy

The `api/ai-chat.js` serverless function handles AI requests in production.

---

## Project Structure

```
inferscope/
├── api/
│   └── ai-chat.js              # Vercel serverless — Groq proxy with input sanitization
├── src/
│   ├── App.jsx                  # 3-tab shell + theme toggle + AI Advisor FAB
│   ├── store/dashboardStore.js  # Zustand (5 slices, cross-tab actions)
│   ├── constants/
│   │   ├── modelDefaults.js     # 8 seed models with full metadata
│   │   ├── providerMetadata.js  # 6 API providers + 5 GPU pricing entries
│   │   └── taskCategories.js    # Task filters + scenario multipliers
│   ├── lib/
│   │   ├── costCalc.js          # Pure functions: calculateCosts, volumeCurve, scenarios
│   │   ├── openRouterClient.js  # OpenRouter /api/v1/models fetch + normalize
│   │   ├── arenaClient.js       # LMSYS Arena leaderboard fetch + normalize
│   │   ├── dataNormalizer.js    # Merge multi-source data into unified Model shape
│   │   └── aiClient.js          # POST /api/ai-chat wrapper with sanitization
│   ├── hooks/
│   │   ├── useModelData.js      # SWR hook — fetches + merges all model data
│   │   └── useCostCalculator.js # useMemo — reactive cost computation
│   ├── components/
│   │   ├── ui/
│   │   │   ├── MetricCard.jsx   # KPI card with optional info tooltip
│   │   │   ├── InfoTooltip.jsx  # Hover/click educational tooltip
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   └── advisor/
│   │       └── AdvisorPanel.jsx # Slide-out AI chat with context badges
│   └── tabs/
│       ├── ModelArena/index.jsx     # Leaderboard, filters, Arena Insight sidebar
│       ├── CostCalculator/index.jsx # Inputs, metric cards, cost charts
│       └── InfraExplorer/index.jsx  # Provider cards, GPU pricing table
├── DESIGN.md                    # Precision Slate design system (from Stitch)
├── CLAUDE.md                    # Claude Code instructions
├── tailwind.config.js           # Design tokens mapped to Tailwind
├── vite.config.js               # Dev server + Groq API proxy plugin
└── vercel.json                  # SPA fallback routing
```

---

## Security

- **API key isolation** — `GROQ_API_KEY` lives in `.env.local` (gitignored), never in client-side code. Proxied through Vercel serverless / Vite dev middleware.
- **Input sanitization** — Chat messages stripped of non-printable characters, capped at 500 chars (both client and server).
- **Generic error messages** — API errors return user-safe messages, no internal details leaked.
- **Numeric validation** — Calculator inputs enforce `min=0` to prevent negative/NaN cost projections.
- **Error boundary** — App-level React error boundary catches render crashes with recovery UI.

## License

MIT
