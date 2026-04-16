# InferScope

AI Model Intelligence Dashboard — compare LLMs, estimate inference costs, and explore infrastructure providers in one place.

## Features

- **Model Arena** — Live leaderboard with Arena ELO ratings, quality scores, and task-specific filters (Code, Reasoning, Chat, Creative). Select models for side-by-side comparison.
- **Cost Calculator** — Interactive inference cost estimator. Pick a model, set token volumes and request rates, adjust caching hit rate, and toggle Low/Base/High traffic scenarios. Visualizes cost breakdown and cost-vs-volume sensitivity.
- **Infra Explorer** — Compare API providers (Together AI, Groq, AWS Bedrock, Replicate, OpenRouter, Fireworks AI) and self-hosted GPU pricing (H100, A100, L40S across Lambda, RunPod, AWS).
- **AI Advisor** — Persistent side panel powered by Groq (Llama 3.3 70B). Ask for model recommendations grounded in live dashboard data — it sees your selected model, calculator scenario, and pricing context.
- **Cross-tab flows** — Click "CALCULATE" on any model to auto-fill the Cost Calculator. Click "ESTIMATE COST" on a provider to navigate with context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand (subscribeWithSelector) |
| Data Fetching | SWR |
| Charts | Recharts |
| UI Components | Headless UI, Heroicons |
| AI Backend | Groq API (Llama 3.3 70B) |
| Icons | Material Symbols Outlined |
| Deployment | Vercel |

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

Create a `.env` file in the project root:

```
GROQ_API_KEY=your_groq_api_key_here
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The Vite dev server includes a built-in API proxy that routes `/api/ai-chat` requests to Groq, so the AI Advisor works locally without needing Vercel.

### Building for Production

```bash
npm run build
npm run preview
```

### Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `GROQ_API_KEY` as an environment variable in Vercel project settings
4. Deploy

The `api/ai-chat.js` serverless function handles AI requests in production. The `vercel.json` includes SPA fallback routing.

## Project Structure

```
inferscope/
├── api/
│   └── ai-chat.js              # Vercel serverless function (Groq proxy)
├── src/
│   ├── App.jsx                  # 3-tab shell + AI Advisor FAB
│   ├── store/dashboardStore.js  # Zustand store (5 slices)
│   ├── constants/               # Seed data, provider metadata, task categories
│   ├── lib/                     # API clients, cost calculations, data normalization
│   ├── hooks/                   # SWR data hooks, cost calculator hook
│   ├── components/
│   │   ├── ui/                  # MetricCard, LoadingSpinner, ErrorBoundary
│   │   └── advisor/             # AI Advisor slide-out panel
│   └── tabs/
│       ├── ModelArena/          # Tab 1: Leaderboard + filters + insights
│       ├── CostCalculator/      # Tab 2: Inputs + outputs + charts
│       └── InfraExplorer/       # Tab 3: Provider cards + GPU pricing
├── DESIGN.md                    # Precision Slate design system (from Google Stitch)
├── CLAUDE.md                    # Claude Code instructions
├── tailwind.config.js           # Design tokens
└── vite.config.js               # Dev server + API proxy plugin
```

## Design System

"Precision Slate" — designed in Google Stitch. Dark navy (#0f172a) background with warm gold (#ffe188) accents, Inter font, no-border card layering, glassmorphism for floating elements.

## Data Sources

| Source | Data | Auth |
|--------|------|------|
| OpenRouter `/api/v1/models` | Model pricing across 300+ models | None |
| LMSYS Arena (wulong.dev) | ELO ratings and rankings | None |
| Seed data (bundled) | Fallback model data when APIs unavailable | N/A |

## License

MIT
