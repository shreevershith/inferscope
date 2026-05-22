# InferScope

AI Model Intelligence Dashboard — compare LLMs, estimate inference costs, and explore infrastructure providers in one place.

**🔗 Live demo: [inferscope.vercel.app](https://inferscope.vercel.app/)**

## What This Dashboard Does

InferScope answers three questions every engineer building with LLMs faces:

1. **"Which model should I use?"** — The Model Arena tab merges live OpenRouter pricing (~350 models) with z-score-normalized Arena ELO scores across 5 leaderboards into a single sortable, filterable, fuzzy-searchable leaderboard with a dual-layer Quality vs Cost scatter chart and Pareto frontier. Export to CSV in one click.

2. **"What will it cost in production?"** — The Cost Calculator projects monthly/annual costs from your token volumes and traffic profile, then surfaces a Pareto-ranked **Workload Recommendation** panel showing the 3 best-fitting models for your exact configuration. Smart token defaults adapt to the selected model's use case (reasoning, code, chat, creative).

3. **"Where should I deploy?"** — The Infra Explorer derives a live API-provider catalog from the OpenRouter model list and pulls live GPU pricing from Vast.ai (p25–p75 market band), with side-by-side comparison tools and a folded "niche providers" group for the long tail.

The AI Advisor (powered by Groq · Llama 3.3 70B) ties it all together — it sees your selected model, your calculator scenario, projected monthly cost, and live Arena leaderboard, then returns structured **Recommendation / Why / Trade-off** answers grounded in your actual numbers. Suggested questions are personalized to your current state.

---

## Features

### Tab 1: Model Arena

A live leaderboard ranking AI models by quality and cost-effectiveness.

**What each column means:**

| Column | Description | Source |
|--------|-------------|--------|
| **Rank** | Position based on Arena ELO score (descending) | Computed |
| **Model Name** | The model's public identifier | OpenRouter (live, ~350 models) |
| **Provider** | The company that built/hosts the model | Derived from OpenRouter model ID prefix |
| **Arena ELO** | Skill rating from human blind A/B comparisons. Merged across text + code + vision + document + search boards (highest ELO wins per model). Higher = better — a 1300 ELO model beats a 1200 ELO model ~64% of the time | arena-ai-leaderboards (wulong.dev API, live) |
| **Quality** | Normalized 0-100 score derived from Arena ELO: `score = ((elo - 1100) / 500) * 100`, clamped to [0, 100]. Band widened from `/300` so top-tier models (Opus 4.7 = 93, Opus 4.6 = 89, GLM 5.1 = 86) differentiate instead of clamping to 100. Models without ELO fall back to a price-tier heuristic | Computed |
| **Value** | Quality / log(price). Requires `qualityScore ≥ 50` floor to prevent ultra-cheap micro-models from gaming the metric. Excludes free + variable-priced router models | Computed |
| **Context** | Maximum input token window (128K, 200K, 1M, …). Determines how much text the model can process in a single request | OpenRouter API |
| **Input $/M** | Cost per 1M input tokens. Renders `Variable` (routed/auto), `Free`, or `$X.XX` | OpenRouter API |
| **Out $/M** | Cost per 1M output tokens (replaced the removed Speed column — no public per-model tokens/sec API exists) | OpenRouter API |

**Filters:**
- **Provider** — Filter by model creator (alphabetically sorted, 30+ derived from live data)
- **License** — Open source vs proprietary
- **Focus Task** — Code, Reasoning, Chat, Creative. Filtered by `taskStrengths` which is inferred from both name regex AND OpenRouter's `description` field (≥2 keyword hits required). Frontier models (ELO ≥ 1490) with `chat` strength automatically get `creative` as well. Chat-tagged models with a single creative hint in their description also qualify
- **Search** — Three-tier fuzzy search: exact > substring > Damerau-Levenshtein (≤2 edits). Searches name + provider + description. Debounced 200ms so 350-model fuzzy doesn't fire per keystroke

**Toolbar:**
- **EXPORT CSV** — Downloads current filtered set with 12 columns (Rank, Model, Provider, Arena ELO, Quality, Value, Context, Input $/M, Output $/M, License, Modalities, Task Strengths). RFC-4180-compliant escaping, UTF-8 BOM for Excel, formula-injection-safe (cells starting with `=+@-` are tab-prefixed)
- **COMPARE N MODELS** — Opens slide-up drawer (appears when 2-3 rows checked)

**Sidebar panels:**
- **Arena Insight** — Interactive bar chart with 4 views (ELO, Price, Context, Value Score) over the top 6 currently-filtered models. Bar labels strip provider prefix and qualifier
- **Optimization Tip** — Rotates through 7 dynamic generators every 12s, each suggesting a different optimization. Manual click cycles. Generators trigger conditionally on the user's state:
  - **Cheaper alternative** — switch to the value-score winner
  - **Open-source alternative** — when selected is proprietary AND open ≥70% of its quality
  - **Cache more aggressively** — when cache hit rate < 60% AND bill > $1/mo
  - **Smaller sibling** — same family, cheaper, ≥70% quality (Opus → Sonnet → Haiku ladder)
  - **Context overkill** — using < 5% of a 200K+ window
  - **Output-heavy workload** — output tokens ≥ 1.5× input
  - **Underrated pick** — non-mainstream provider with ELO ≥ 1400 and price ≤ $3/M

**Model Comparison (≤3 models):** Slide-up drawer with radar chart (Quality, Value, Context, Input Affordability, Output Affordability) and detailed metrics table. New **Cost / Quality** row (lower = better) directly identifies the most cost-efficient pick among compared.

**Quality vs Cost Scatter Chart** — Dual-layer visualization below the leaderboard:
- **Background layer** (faded): all benchmarked models (those with real Arena ELO + valid pricing) plotted as low-opacity dots, giving a market-wide distribution overview
- **Foreground layer** (colored): models matching the active Focus Task filter, plotted as bright dots with higher opacity and distinct stroke
- **Pareto frontier**: models where no other model has both higher quality AND lower cost are highlighted in green with a "★ PARETO OPTIMAL" tooltip badge
- Axes: X = Output $/M (log-spaced ticks), Y = Quality Score (0-100). Only models with real Arena ELO are shown — imputed quality scores (from price tiers) create misleading horizontal bands
- Click any dot → selects the model in the leaderboard. Collapsible via chevron toggle

**Cross-tab flow:** Click "CALCULATE" on any row → the model's pricing auto-fills into the Cost Calculator tab.

---

### Tab 2: Cost Calculator

An interactive inference cost estimator that projects what running a model will cost at your scale.

**Inputs:**

| Input | Default | Description |
|-------|---------|-------------|
| Inference Model | _Auto-selects #1 priced model on first load_ | Dropdown of all tracked models. Variable-priced router models are disabled. Free models labeled "Free", routed models labeled "Variable" |
| Input Tokens / Request | 500 | Average number of tokens in each prompt you send to the model |
| Output Tokens / Request | 200 | Average number of tokens the model generates per response |
| Requests / Day | 1,000 | How many API calls you expect per day |
| Cache Hit Rate | 30% | Percentage of input tokens served from cache (cached tokens cost ~90% less) |
| Traffic Profile | Base | Low (0.25×), Base (1×), High (5×), or Spike (20×). Each multiplier is tunable inline — click the number to override, refresh icon to reset |

**Smart Defaults** — When a model is selected, a "Use {use-case} defaults" pill appears below the model dropdown if the current values differ from the inferred preset:
- **Reasoning** model → 800 in / 3000 out / 500 req/day (thinking models output a lot)
- **Code** model → 2000 in / 600 out / 1500 req/day (file context)
- **Creative** model → 400 in / 1500 out / 200 req/day
- **Chat** model → 200 in / 150 out / 5000 req/day
- **Large-context (≥200K) chat** → 5000 in / 500 out / 1000 req/day (RAG / analysis)

Click applies the preset. Hover shows the rationale.

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
- **Cost vs Volume** — Line chart plotting monthly cost across 8 log-spaced volumes centered on the user's current `requestsPerDay` (factors 0.01x → 30x). Shows the selected model (gold line) plus up to 2 comparison models from Workload Recommendations (cyan + violet lines). The user's actual input sits roughly mid-curve regardless of scale. Uses a log-scale X-axis so decade spacing stays proportional, avoiding the misleading hockey-stick artifact at linear scale. Low/High/Base scenario band lines were removed — they were proportional to the base line and only stretched the Y-axis without adding shape variation.

**Metric cards** include optional trend chips ("Efficient ↑", "30% hit rate ↑") and source tags ("LIVE · OPENROUTER", "12-month projection") to ground each number in its origin.

**Real-time timestamps** — Shows when pricing data was last refreshed (e.g., "2m ago"), with a live pulse indicator.

**Debounced inputs** — Token-input fields use 300ms debounce before pushing to the store, preventing Recharts from re-rendering on every keystroke.

**Scenario multipliers (all tunable inline):**

| Scenario | Default Multiplier | Use Case |
|----------|-------------------|----------|
| Low | 0.25× | Dev / staging / off-peak |
| Base | 1.0× | Production baseline |
| High | 5.0× | Sustained peak |
| Spike | 20.0× | Bursts, campaigns, viral spikes |

Edit any multiplier directly — overrides are stored per-user in Zustand `calculatorInputs.scenarioOverrides`. A reset icon appears next to overridden values to return to default.

**Workload Recommendation panel** — Pareto-ranked top 3 models for the user's exact configuration. Score:

```
score = qualityScore − 30 × log₁₀(monthlyCost + 1)
```

Rewards quality linearly, penalizes log-cost. At equal quality the cheaper model wins; at equal cost the higher quality wins. The 30× coefficient means a $1000/mo model needs ≈+90 quality points to beat a $1/mo one.

Cards labeled **Best Overall** (gold) · **Cheapest Quality** (emerald, when applicable) · **Runner-Up** (slate). Each shows projected $/mo, quality score, ELO, and a one-line reasoning. Filters: **Open-source only** checkbox + **Max $/mo** budget input. Click "USE THIS MODEL" → applies it to the calculator immediately.

---

### Tab 3: Infra Explorer

Compare API inference providers and self-hosted GPU options side-by-side. **Both panels are 100% live** — no hardcoded data.

**API Provider Cards** — derived from the live OpenRouter catalog at render time:

| Field | How it's computed |
|-------|------------------|
| **Name** | Provider prefix from OpenRouter model IDs, prettified (`anthracite-org` → "Anthracite", `aion-labs` → "Aion Labs", `inclusionai` → "Inclusion AI", `ibm-granite` → "IBM Granite", 50+ canonical names). Tilde aliases (`~openai`) fold into the canonical provider |
| **Models** | Count of models that prefix yields in the live catalog |
| **Open models** | Sub-count where `license === 'open'` |
| **Price range** | `$<min input> - $<max output>`, or `Free` / `Variable (routed)` / `Free / routed` / `—` depending on the provider's mix |
| **Top ELO** | Highest Arena ELO from any of that provider's models, with the model name shown |
| **Icon + homepage URL** | Static UI lookup table (`getProviderVisual`) — falls back to a generic icon for unknown providers |

Providers with **< 3 models** are folded into a collapsed "Show N niche providers" section to keep the main grid scannable. New providers appear automatically as OpenRouter adds them — no code change.

**GPU Pricing Table** — pulled live from Vast.ai's public bundles API via the `/api/gpu-pricing` serverless proxy:

| Field | Source |
|-------|--------|
| **GPU Model** | `gpu_name` from each verified, rentable, on-demand offer |
| **VRAM (GB)** | Median across offers, rounded |
| **$/hr (best)** | Cheapest single-GPU price observed |
| **$/hr (p25–p75)** | 25th-75th percentile band across current offers (`dph_total / num_gpus`). Collapses to a single price when only one offer exists |
| **DL Perf** | Median `dlperf` score per GPU |
| **Offers** | Count of live offers for that GPU model |

Cached 1h on Vercel edge with `stale-while-revalidate=86400` so refreshes are cheap. Plus a 24h localStorage cache (`inferscope-gpu-pricing-cache-v1`) so returning visitors see real GPUs on first paint. Currently surfaces ~25 GPU types (B200, H200, H100, MI300X, A100, L40S, RTX 4090, etc.) depending on Vast.ai availability.

When Vast.ai fails but cache exists, an amber section-level notice appears ("GPU data from 2h ago — Vast.ai unavailable, showing last good snapshot."). Total failure (fetch dead + no cache) shows a placeholder.

**GPU Comparison:** Select 2-3 GPUs via checkboxes → click "Compare Selected" → a slide-up drawer shows a radar chart (VRAM, Affordability, DL Perf, Efficiency, Availability) and a detailed metrics table with best-value highlights (perf-per-dollar, VRAM-per-dollar).

**Cross-tab flow:** Click "ESTIMATE COST" on any provider → navigates to Cost Calculator with that provider selected.

---

### AI Advisor (Slide-Out Panel)

A Groq-powered (Llama 3.3 70B) conversational assistant available from any tab via the floating sparkle button.

**Structured answers** — The system prompt forces a 3-part response format:

```
**Recommendation:** <one specific model name from the live state>
**Why:** <one sentence grounded in user's actual numbers — req/day, $/mo, cache rate, quality>
**Trade-off:** <one sentence on what they give up vs the next-best alternative>
```

For comparison questions, the model gives two recommendations (primary + runner-up) in the same structure. Capped at 180 words. The system prompt provides an explicit decision framework (hard constraints → quality floor → cost → caching → specialization) and tells the model to always cite a specific model from the top-10 list, always include a dollar figure, and always consider an open-source alternative when the user's selected model is proprietary AND bill > $50/mo.

**Active Context Feed sidebar** — Shows exactly what the AI can see:
- **Selected Model** with its input price
- **Projected Cost** ($/mo, computed by the same math as the Cost Calculator)
- **Request Volume** and scenario
- **Cache Hit Rate**
- **Top-Ranked model** by ELO

**Personalized Suggested Questions** — 5 questions generated dynamically from 7 templates that inspect the user's state and pick what's most relevant. Examples when Claude Opus 4.7 is selected at 1K req/day with 30% cache:
- *"How can I cut Claude Opus 4.7's $1.3K/mo bill in half?"*
- *"What's the best open-source alternative to Claude Opus 4.7?"*
- *"What kinds of prompts should I cache to raise my hit rate above 60%?"*
- *"What would my $1.3K/mo look like at 10K req/day?"*

When no model is selected, falls back to evergreens (`Best model under $500/month?`, `Cheapest model for RAG?`, `When is prompt caching worth setting up?`).

**Error UX** — Network/API failures render as distinct rose-tinted bubbles with an error icon. Errors are classified by `err.source` (typed via `ApiClientError`):
- `timeout` → *"The AI took too long to respond. Try a shorter question."*
- `network` → *"Network unavailable. Check your connection and try again."*
- `rate-limited` → *"AI service is busy. Please wait a moment and retry."*
- `empty / parse` → *"AI service returned an unexpected response. Try rephrasing."*

**Guardrails:**
- Scoped to AI/ML model selection and infrastructure topics
- User message + all context fields sanitized server-side (prompt-injection-redacted, control chars stripped, length-capped per field)
- API key never exposed to the browser (proxied through Vercel serverless / Vite dev middleware)
- 30-second `AbortController` timeout on every chat request — no infinite spinners
- Only mounted when open (saves idle subscriptions); wrapped in `ErrorBoundary` so chunk-load failures don't take down the app

---

### Hero Banner

A persistent banner below the header showing:
- **AI Model Intelligence** headline with tagline
- **Live stat chips** — Models Tracked, Providers monitored, Last Refreshed timestamp (real, from actual fetch completion — not merge re-render time)

### Stale-Cache Banner

When **both** OpenRouter and Arena fetches fail AND we have localStorage cache to fall back on, a top-of-app amber banner appears: *"Showing cached data from 3h ago — OpenRouter unavailable. Numbers below may be stale. [Retry] [×]"*. The Retry button calls SWR's `mutate('model-data', undefined, { revalidate: true })` to force a fresh fetch.

This is the **app-level** rung of a 3-tier error UX hierarchy. The other two rungs:
- **Section-level**: amber notice inside Infra Explorer when Vast.ai fails but cache exists
- **Action-level**: inline rose-tinted error bubble in the AI Advisor chat

Same failure mode → matched scope of presentation.

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
| Model Arena | `model_select`, `filter_apply` (incl. `csv_export`), `compare_open`, `arena_insight_view`, `calculate_from_arena`, `external_link_click` | `model_id`, `model_name`, `filter_type`, `value`, `view`, `model_count`, `url`, `context` |
| Cost Calculator | `calculator_scenario_change` | `scenario` (low/base/high/spike) |
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

6 slices with `subscribeWithSelector` middleware. All consumer components select atomic fields (`useDashboardStore(s => s.calculatorInputs.cachingHitRate)`) — no whole-store subscribers, so a slice update only re-renders components that read that slice.

| Slice | State | Purpose |
|-------|-------|---------|
| **models** | `modelList[]`, `modelsLoading`, `modelsLastFetched` | Merged model data from all API sources |
| **pricing** | `pricingMap{}`, `providers[]` | Per-model pricing details |
| **calculator** | `calculatorInputs{}`, `selectedProvider` (incl. `scenarioOverrides{}` for tunable multipliers) | All cost calculator parameters |
| **advisor** | `chatMessages[]`, `isChatLoading`, `isPanelOpen` | AI chat state |
| **ui** | `theme`, `activeTab`, `compareModels[]` | UI preferences |
| **tour** | `tourChapter`, `tourStep` | Active tour state |

### Data Fetching (SWR)

| Source | Cache Duration | Dedup Interval | Rationale |
|--------|---------------|----------------|-----------|
| OpenRouter `/api/v1/models` | 1 hour | 15 min | Catalog + pricing — primary model source (~350 models). SWR retries on error (2 attempts) |
| Arena leaderboards (text + code + vision + document + search, via wulong.dev) | 1 hour | 15 min | ELO overlay — **z-score-normalized per board** before merging so different-distribution boards compete fairly. Highest z wins per model, mapped back to a synthetic ELO using the text board's mean+stddev. SWR retries on error (2 attempts) |
| Vast.ai GPU bundles (via `/api/gpu-pricing` proxy) | 1 hour edge cache + SWR 1h | 15 min | Live GPU supply + prices, aggregated to p25/median/p75 |
| localStorage `inferscope-models-cache-v3` | 24h TTL | — | Disk-side hydration of model data — returning visitors see real data on first paint |
| localStorage `inferscope-gpu-pricing-cache-v1` | 24h TTL | — | Disk-side hydration of GPU pricing |
| `FALLBACK_MODELS` (1 sentinel "data unavailable" row) | Instant | — | Last-resort UI state when both upstreams fail and no cache exists |

Cache version suffix is bumped whenever the merged Model shape changes so stale-shape caches get invalidated automatically (`v1` → `v2` → `v3` history is documented inline in `useModelData.js`).

### Data Normalization

OpenRouter is the primary catalog. Arena ELO is layered on via a fuzzy matcher that:
1. Strips `"Provider: "` prefix and `"(qualifier)"` suffix from OpenRouter names before comparing
2. Prefers longest substring overlap (so `GPT-5.5` wins over `GPT-5` when matching `gpt-5.5-high`)
3. Falls back to base-model matching for Arena suffixes (`-thinking`, `-high`, `-instant`, date stamps)
4. When multiple Arena entries map to the same OpenRouter model, keeps the highest ELO

Model names returned by OpenRouter as `"Provider: ModelName"` are stripped of the redundant prefix at normalization time (Provider already has its own column).

Each merged model has this shape:

```js
{
  id: "anthropic/claude-opus-4-7",       // OpenRouter id
  name: "Claude Opus 4.7",                // prefix stripped
  provider: "Anthropic",                  // canonical (prettified from id slug)
  arenaElo: 1500,                         // z-score-normalized synthetic ELO
  voteCount: 11197,
  qualityScore: 80,                       // ((elo - 1100) / 500) * 100, clamped
  valueScore: 89,                         // quality / log10(price + 1.5) * 10
  inputPricePerMToken: 15.0,              // null for variable-priced routers, 0 for free
  outputPricePerMToken: 75.0,
  cachedInputPrice: 1.5,                  // 10% of input (no live cache pricing)
  isVariablePrice: false,                 // true for dynamic router models
  contextWindow: 200000,
  contextLabel: "200K",
  license: "proprietary",
  modalities: ["text", "vision"],
  taskStrengths: ["chat", "reasoning"],   // inferred from name regex + ≥2 hits in description
  description: "...",                     // OpenRouter description, capped 600 chars
  rank: 1
}
```

Priority: live OpenRouter catalog → Arena ELO overlay → localStorage cache → in-memory fallback sentinel.

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

**Rules:** No 1px borders (use background color shifts). Glassmorphism for floating elements. Inter font throughout. Dark mode is default; light mode fully supported with theme-responsive chart axes, grids, tooltips, card surfaces, and recommendation tags (all via `dark:` Tailwind prefix pattern). Brand glow animation on logo. Live pulse indicators for data freshness.

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
│   ├── ai-chat.js              # Vercel serverless — Groq proxy. Rate limit, ALLOWED_ORIGIN CORS, OPTIONS preflight, prompt-injection sanitization
│   └── gpu-pricing.js          # Vercel serverless — Vast.ai bundles aggregator (p25/median/p75, 1h edge cache, CORS-gated, OPTIONS preflight)
├── src/
│   ├── App.jsx                  # 3-tab shell + lazy-loaded tabs + theme toggle + AI Advisor FAB + welcome tour + footer
│   ├── store/dashboardStore.js  # Zustand (6 slices, cross-tab actions, scenarioOverrides for tunable multipliers)
│   ├── constants/
│   │   ├── modelDefaults.js     # FALLBACK_MODELS — 1-row sentinel when all upstreams fail
│   │   ├── providerMetadata.js  # deriveProviders() + getProviderVisual() (50+ prettified names, UI icons/URLs only)
│   │   └── taskCategories.js    # Task filters + scenario multipliers (Low/Base/High/Spike)
│   ├── lib/
│   │   ├── costCalc.js              # Pure: calculateCosts, getAdaptiveVolumeTicks, scenarios (with scenarioOverrides)
│   │   ├── openRouterClient.js      # OpenRouter /api/v1/models fetch + normalize. Prefix stripping, throttled warnings
│   │   ├── arenaClient.js           # Arena boards (5) — z-score-normalized merge, throttled warnings
│   │   ├── gpuPricingClient.js      # Fetch /api/gpu-pricing (live Vast.ai)
│   │   ├── dataNormalizer.js        # Fuzzy Arena↔OpenRouter merge + computed fields (quality, taskStrengths)
│   │   ├── ApiClientError.js         # Shared typed error class (status, source, cause) used by all API wrappers
│   │   ├── aiClient.js              # POST /api/ai-chat. AbortController 30s, typed ApiClientError with .source
│   │   ├── advisorPrompts.js        # 7 dynamic suggestion generators for the Advisor panel
│   │   ├── optimizationTips.js      # 7 dynamic tip generators (cost, caching, open-source, family ladder, …)
│   │   ├── smartDefaults.js         # Use-case-based token defaults (reasoning/code/creative/chat/RAG)
│   │   ├── workloadRecommender.js   # Pareto-ranked top-3 models for given workload (in Cost Calculator)
│   │   ├── fuzzySearch.js           # 3-tier Damerau-Levenshtein search across name/provider/description
│   │   ├── csvExport.js             # RFC-4180-compliant CSV builder + download trigger (formula-injection-safe)
│   │   ├── timeUtils.js             # Relative timestamp formatting (e.g., "2m ago")
│   │   ├── telemetry.js             # GA4 + custom events (consent-gated). Named to dodge ad-blocker filters
│   │   └── tourTriggers.js          # Per-chapter localStorage flags + auto-trigger logic
│   ├── hooks/
│   │   ├── useModelData.js          # SWR + localStorage cache (v3). Exposes sourceErrors/fromCache/hasPartial/hasTotal
│   │   ├── useGpuPricing.js         # SWR + localStorage cache (v1). Same error-shape contract as useModelData
│   │   └── useCostCalculator.js     # Atomic Zustand selectors + useMemo — reactive cost computation without whole-object subscriptions
│   ├── components/
│   │   ├── HeroBanner.jsx           # Live stats banner (models tracked, providers, last refresh)
│   │   ├── StaleCacheBanner.jsx     # App-level amber banner when both fetches fail + cache is showing
│   │   ├── WelcomeTour.jsx          # Contextual 4-chapter workflow tour with rAF spotlight loop
│   │   ├── ConsentBanner.jsx        # Cookie consent banner (gates GA loading)
│   │   ├── Footer.jsx               # Data source attribution (OpenRouter · Arena · Vast.ai · Groq)
│   │   ├── ui/
│   │   │   ├── MetricCard.jsx       # KPI card with tooltip (z-elevated on hover to prevent card overlap), trend chips, source tags
│   │   │   ├── InfoTooltip.jsx      # Hover/click educational tooltip
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── SkeletonCard.jsx
│   │   │   └── ErrorBoundary.jsx    # Wraps lazy chunks + Advisor; keyed per tab so crashes don't persist
│   │   └── advisor/
│   │       └── AdvisorPanel.jsx     # Slide-out AI chat with Active Context Feed + personalized suggestions
│   └── tabs/
│       ├── ModelArena/
│       │   ├── index.jsx                # Leaderboard, filters, fuzzy search, CSV export, Arena Insight sidebar
│       │   ├── ArenaInsight.jsx         # Interactive bar chart sidebar (4 views)
│       │   ├── QualityCostScatter.jsx   # Dual-layer scatter chart: task-filtered + all-models + Pareto frontier
│       │   ├── OptimizationTip.jsx      # Cycling tip card with auto-rotate + manual next
│       │   └── ModelCompareDrawer.jsx   # Model comparison drawer (radar + table, incl. Cost/Quality)
│       ├── CostCalculator/index.jsx     # Inputs, smart defaults, scenario editor, charts, WorkloadRecommendations
│       └── InfraExplorer/
│           ├── index.jsx                # Provider cards (primary + niche fold), live GPU table with p25-p75 band
│           └── GpuCompareDrawer.jsx     # GPU comparison drawer (radar + table)
├── DESIGN.md                    # Precision Slate design system (from Stitch)
├── CLAUDE.md                    # Claude Code instructions
├── GA_SETUP.md                  # Google Analytics 4 setup guide
├── tailwind.config.js           # Design tokens mapped to Tailwind
├── vite.config.js               # Dev server + Groq + GPU-pricing proxy plugins
└── vercel.json                  # SPA fallback routing
```

---

## Security

- **API key isolation** — `GROQ_API_KEY` lives in `.env.local` (gitignored), never in client-side code. Proxied through Vercel serverless / Vite dev middleware. No `VITE_*` prefix on it so Vite cannot expose it to the bundle.
- **Prompt injection defense** — All `context` fields (top models, calculator scenario, selected provider) are sanitized server-side before being interpolated into the system prompt. Patterns like "ignore previous instructions" are redacted, non-printable chars stripped, lengths capped per field. Applied in both `api/ai-chat.js` and the Vite dev proxy.
- **Input sanitization** — User messages stripped of non-printable characters, capped at 500 chars (both client and server).
- **Rate limiting** — In-memory IP-based rate limiter: 10 req/min in production (`api/ai-chat.js`), 30 req/min in dev (`vite.config.js`). Returns `429` with a user-safe retry message. **Spoof-resistant IP extraction:** prefers `x-real-ip` (set by Vercel), then the rightmost `x-forwarded-for` entry, then `socket.remoteAddress`. Never trusts the leftmost XFF (which any client can set).
- **Body size caps** — Request bodies are capped (4KB production, 8KB dev) to prevent memory-abuse attacks.
- **CORS hardening** — `ALLOWED_ORIGIN` env var restricts both `/api/ai-chat` and `/api/gpu-pricing` to your production domain.
- **Generic error messages** — API errors return user-safe messages; internal details (hostnames, stack traces) are logged server-side only, never leaked to clients.
- **Response validation** — External API responses (OpenRouter, Arena leaderboards, Vast.ai) are shape-checked and timeouts enforced via `AbortController` (10s for upstreams, 30s for Groq via `aiClient`). Malformed individual entries are dropped rather than crashing the whole batch. Normalization warnings are throttled to 3 per session so a schema break doesn't flood the console.
- **Typed client errors** — All API client wrappers use a shared `ApiClientError` class (`src/lib/ApiClientError.js`) with `.status`, `.source`, and `.cause` properties. Sources: `timeout` / `network` / `rate-limited` / `parse` / `empty` / `server` / `openrouter` / `arena` / `gpu-pricing`. The UI classifies errors by `.source` to render targeted messages instead of generic "something failed".
- **CSV formula injection** — `csvExport.js` prefixes cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a tab character to prevent formula execution in Excel and Google Sheets.
- **OPTIONS preflight** — Both serverless endpoints (`api/ai-chat.js`, `api/gpu-pricing.js`) handle CORS preflight requests, returning 204 with appropriate `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` headers.
- **NaN firewall** — All numeric calculator inputs are coerced to finite non-negative numbers via `safeNum`. `cachingHitRate` is clamped to [0, 100]. Optimization tips use a `ratio()` helper that returns 0 for non-finite denominators — no NaN can leak to the DOM.
- **Error boundary** — `ErrorBoundary` wraps every lazy-loaded tab (keyed per tab so a crash clears when the user switches) and the AdvisorPanel. A failed chunk fetch or render bug shows a recovery UI instead of a white screen.
- **Consent-gated analytics** — Google Analytics script is never injected until the user explicitly accepts the consent banner. No cookies set before consent. Declining preserves zero tracking for the session.
- **localStorage hygiene** — Cached payloads are validated on read (shape check + `fetchedAt` freshness). Quota-exceeded writes fail silently. Cache key version bumps invalidate stale shapes (`v3` currently for models, `v1` for GPU).
- **No `dangerouslySetInnerHTML`** — Every external string (model name, description, error message, chat response) is rendered as text content. Verified zero instances across `src/`.

## License

MIT
