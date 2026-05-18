import { FALLBACK_MODELS } from '../constants/modelDefaults'

/**
 * Merge live data from OpenRouter (catalog + pricing) and Arena leaderboards (ELO).
 *
 * Primary source: OpenRouter — every model it returns becomes a row.
 * Overlay: Arena ELO via fuzzy name match.
 * Fallback: FALLBACK_MODELS only when both upstreams fail (empty result).
 *
 * No model is gated by a hardcoded whitelist. New providers/models appear
 * automatically as upstreams update.
 */
export function mergeModelData({ arenaModels = [], openRouterModels = [] }) {
  // If OpenRouter returned nothing, use whatever Arena gave us as a skeleton.
  // If both empty, caller will fall back to FALLBACK_MODELS.
  if (openRouterModels.length === 0 && arenaModels.length === 0) {
    return FALLBACK_MODELS.map((m, i) => ({ ...m, rank: i + 1, lastUpdated: today() }))
  }

  // Build the canonical map keyed by OpenRouter id (or arena name if OR is empty)
  const merged = new Map()

  for (const orModel of openRouterModels) {
    if (!orModel?.id) continue
    merged.set(orModel.id, {
      ...orModel,
      taskStrengths: inferTaskStrengths(orModel.name, orModel.id, orModel.description),
    })
  }

  // If we only have Arena, synthesize stub entries from it
  if (merged.size === 0) {
    for (const arena of arenaModels) {
      if (!arena?.name) continue
      const id = slugify(arena.name)
      merged.set(id, {
        id,
        name: arena.name,
        provider: arena.provider || extractProviderFromName(arena.name),
        providerIcon: 'smart_toy',
        arenaElo: arena.arenaElo,
        voteCount: arena.voteCount,
        license: arena.license || 'proprietary',
        modalities: ['text'],
        taskStrengths: inferTaskStrengths(arena.name, id),
        source: 'arena',
      })
    }
  } else {
    // Layer Arena ELO onto OpenRouter models via fuzzy name match.
    // Multiple Arena entries can map to the same OR model (e.g. the
    // "thinking" and base variants of Claude both point at one OR id) —
    // keep the highest ELO so the better score wins.
    for (const arena of arenaModels) {
      const matchKey = findMatchKey(merged, arena.name)
      if (matchKey) {
        const existing = merged.get(matchKey)
        const incomingElo = arena.arenaElo || 0
        const existingElo = existing.arenaElo || 0
        if (incomingElo > existingElo) {
          merged.set(matchKey, {
            ...existing,
            arenaElo: incomingElo,
            voteCount: arena.voteCount || existing.voteCount,
          })
        }
      }
    }
  }

  // Finalize: compute quality, sort, rank
  const models = Array.from(merged.values())
    .map((m) => ({
      ...m,
      qualityScore: computeQualityScore(m),
      lastUpdated: today(),
    }))
    .sort((a, b) => {
      // ELO first, then by quality, then by price (cheap last as tiebreaker)
      const eloA = a.arenaElo || 0
      const eloB = b.arenaElo || 0
      if (eloA !== eloB) return eloB - eloA
      const qA = a.qualityScore || 0
      const qB = b.qualityScore || 0
      if (qA !== qB) return qB - qA
      return (a.inputPricePerMToken || 0) - (b.inputPricePerMToken || 0)
    })
    .map((m, i) => ({ ...m, rank: i + 1 }))

  return models
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function extractProviderFromName(name) {
  const lower = String(name).toLowerCase()
  if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'OpenAI'
  if (lower.includes('claude')) return 'Anthropic'
  if (lower.includes('gemini') || lower.includes('palm')) return 'Google'
  if (lower.includes('llama')) return 'Meta'
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'Mistral'
  if (lower.includes('command')) return 'Cohere'
  if (lower.includes('grok')) return 'xAI'
  if (lower.includes('qwen')) return 'Alibaba'
  if (lower.includes('deepseek')) return 'DeepSeek'
  return 'Unknown'
}

// Task-strength tags derived from model name/id + OpenRouter description.
// Two-tier scan: cheap regex on name/id (catches "*-coder", "*-thinking",
// etc.), plus weighted keyword counting in the description so a model that
// explicitly says "optimized for code" gets the code tag even when its name
// doesn't betray it.
const TASK_PATTERNS = {
  code: {
    nameRe: /\b(code|coder|coding|codestral|starcoder|devstral|cogito|coder?)\b/i,
    descKeywords: ['code generation', 'coding', 'programming', 'software engineering', 'debugging', 'pull request', 'refactor'],
  },
  reasoning: {
    nameRe: /\b(reason|reasoning|thinking|qwq|o1|o3|o4|r1|deepresearch|deepthink)\b/i,
    descKeywords: ['multi-step reasoning', 'chain of thought', 'reasoning', 'thinking', 'complex problem', 'mathematical', 'analytical', 'step by step'],
  },
  creative: {
    nameRe: /\b(creative|writer|writing|story|novel|nemo|rocinante|euryale|magnum|mythomax|skyfall|hanami)\b/i,
    descKeywords: ['creative writing', 'storytelling', 'narrative', 'roleplay', 'role-play', 'fiction', 'prose', 'character'],
  },
  chat: {
    // Most general-purpose chat-tuned models qualify
    nameRe: /\b(chat|instruct|turbo|sonnet|opus|haiku|gpt|gemini|llama|mistral|qwen|command|kimi|grok|nova|ernie|hermes|glm)\b/i,
    descKeywords: ['conversation', 'chat', 'assistant', 'dialogue', 'general-purpose', 'helpful'],
  },
}

function inferTaskStrengths(name, id, description) {
  const nameText = `${name || ''} ${id || ''}`
  const descText = String(description || '').toLowerCase()
  const tags = new Set()

  for (const [tag, { nameRe, descKeywords }] of Object.entries(TASK_PATTERNS)) {
    if (nameRe.test(nameText)) {
      tags.add(tag)
      continue
    }
    // Need ≥2 keyword hits in description to claim the tag from desc alone —
    // avoids false positives like "this is not a coding model" matching once.
    let hits = 0
    for (const kw of descKeywords) {
      if (descText.includes(kw)) hits += 1
      if (hits >= 2) { tags.add(tag); break }
    }
  }

  // Reasoning-grade models are usually solid at code too
  if (tags.has('reasoning') && !tags.has('code')) tags.add('code')
  // Always at least chat — most LLMs handle conversational use
  if (tags.size === 0) tags.add('chat')
  return Array.from(tags)
}

// Match an Arena entry (lowercase-hyphenated slug like "claude-opus-4-7-thinking")
// to an OpenRouter model in the map. OpenRouter names look like
// "Anthropic: Claude Opus 4.7 (Fast)" — we strip the "Provider:" prefix and
// "(qualifier)" suffix before normalizing.
//
// Strategy, in order:
//   1. Exact normalized match against cleaned OR name OR raw OR id
//   2. Longest substring overlap (avoids GPT-5.5 matching plain "GPT-5")
//   3. Base-model fallback: strip Arena suffix (-thinking, -high, -instant…)
//      then retry; lets reasoning-variant ELOs flow onto the base model when
//      no thinking-variant exists in the OR catalog
function findMatchKey(map, name) {
  if (!name) return null
  const stripORDecoration = (s) => String(s || '')
    .replace(/^[^:]+:\s*/, '')      // "Anthropic: Claude…" → "Claude…"
    .replace(/\s*\([^)]*\)\s*/g, '') // "Claude Opus 4.7 (Fast)" → "Claude Opus 4.7"
  const normalize = (s) => String(s || '').toLowerCase().replace(/[-_\s.()/:]/g, '')

  const arenaNorm = normalize(name)
  if (!arenaNorm || arenaNorm.length < 3) return null

  // Build normalized entries once
  const entries = []
  for (const [key, value] of map) {
    const cleanedName = stripORDecoration(value.name)
    entries.push({
      key,
      nameNorm: normalize(cleanedName),
      idNorm: normalize(value.id),
    })
  }

  // 1. Exact match
  for (const e of entries) {
    if (e.nameNorm === arenaNorm || e.idNorm === arenaNorm) return e.key
  }

  // 2. Longest substring overlap (prefer longest OR name that's a substring of
  //    arena, or vice versa). Picks "GPT-5.5" over "GPT-5" for "gpt-5-5-high".
  let best = null
  let bestLen = 0
  for (const e of entries) {
    const n = e.nameNorm
    if (n.length < 4 || arenaNorm.length < 4) continue
    if (n.includes(arenaNorm) && arenaNorm.length > bestLen) {
      best = e.key; bestLen = arenaNorm.length
    } else if (arenaNorm.includes(n) && n.length > bestLen) {
      best = e.key; bestLen = n.length
    }
  }
  if (best) return best

  // 3. Base-model fallback: strip Arena trailing qualifiers and retry exact
  const SUFFIX_RE = /(thinking|reasoning|high|medium|low|instant|chat|latest|preview|beta\d*|alpha\d*|nightly|exp|preview\d*|\d{8}|\d{6})+$/i
  let trimmed = arenaNorm
  for (let i = 0; i < 3; i++) {
    const next = trimmed.replace(SUFFIX_RE, '')
    if (next === trimmed || next.length < 4) break
    trimmed = next
  }
  if (trimmed !== arenaNorm && trimmed.length >= 4) {
    for (const e of entries) {
      if (e.nameNorm === trimmed || e.idNorm === trimmed) return e.key
    }
    // Also fuzzy on trimmed
    for (const e of entries) {
      if (e.nameNorm.length >= 4 && (e.nameNorm.includes(trimmed) || trimmed.includes(e.nameNorm))) {
        return e.key
      }
    }
  }
  return null
}

function computeQualityScore(model) {
  if (model.qualityScore) return model.qualityScore  // respect explicit value if present
  if (model.arenaElo) {
    // Normalize ELO ~[1100, 1600] → [0, 100]. Widened from /300 to /500 so the
    // 1400-1600 frontier tier doesn't all clamp to 100 — current top models
    // (Opus 4.7 = 1567, Opus 4.6 = 1546, GLM 5.1 = 1532) now produce
    // distinguishable quality bars.
    return Math.round(Math.min(100, Math.max(0, ((model.arenaElo - 1100) / 500) * 100)))
  }
  // No ELO → infer from price tier (higher price = usually higher quality, rough proxy)
  const price = model.inputPricePerMToken || 0
  if (price >= 10) return 85
  if (price >= 3) return 75
  if (price >= 1) return 65
  if (price > 0) return 55
  return 50
}
