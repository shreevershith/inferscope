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
- React 18 + Vite
- Tailwind CSS v3
- Zustand (state management)
- SWR (data fetching)
- Recharts (charts)
- Headless UI (tabs, transitions)
- Heroicons (icons)

## Architecture
- 3 tabs: Model Arena, Cost Calculator, Infra Explorer
- Persistent AI Advisor slide-out side panel
- Zustand store with subscribeWithSelector middleware
- SWR hooks for API data with stale-while-revalidate caching
- Vercel serverless functions for AI chat proxy
