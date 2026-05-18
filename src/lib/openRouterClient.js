import { getProviderVisual } from '../constants/providerMetadata'

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models'
const FETCH_TIMEOUT_MS = 10_000

export async function fetchOpenRouterModels() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(OPENROUTER_API, { signal: controller.signal })
    if (!res.ok) {
      const error = new Error(`OpenRouter API error: ${res.status}`)
      error.status = res.status
      error.source = 'openrouter'
      throw error
    }
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.data)) {
      const error = new Error('OpenRouter API returned unexpected payload')
      error.source = 'openrouter'
      throw error
    }
    return data.data
  } catch (err) {
    // Re-throw with source for upstream classification
    if (!err.source) err.source = 'openrouter'
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// Sanitize potentially user-influenced strings before they reach the UI
function safeStr(value, maxLen = 200) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen)
}

function safeFloat(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

// OpenRouter uses negative-pricing sentinels (-1, -0.000001, etc.) on
// dynamic router models like "Auto Router" / "Pareto Code Router" /
// "Body Builder" where the actual cost depends on which model gets selected
// at runtime. Treat any negative value as "unknown price" → null so the UI
// can render "—" instead of "$-1000000.00".
function priceOrNull(rawPerToken) {
  const n = safeFloat(rawPerToken) * 1_000_000
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

// OpenRouter formats every model name as "Provider: ModelName" — redundant
// when we also surface the provider in its own column. Strip the prefix when
// it matches the extracted provider so the Model Name column stays clean.
// Leaves standalone names ("Magnum v4 72B", "MythoMax 13B") untouched.
function stripProviderPrefix(rawName, provider) {
  const name = String(rawName || '')
  const colonIdx = name.indexOf(':')
  if (colonIdx < 1 || colonIdx > 30) return name  // no plausible prefix
  const candidate = name.slice(0, colonIdx).trim()
  const remainder = name.slice(colonIdx + 1).trim()
  if (!candidate || !remainder) return name
  // Normalize both for comparison: lowercase, strip punctuation/whitespace
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const a = norm(candidate)
  const b = norm(provider)
  if (!a || !b) return name
  // Exact match OR either is prefix of the other (handles "MoonshotAI" vs
  // "Moonshot", "ByteDance Seed" vs "ByteDance"). Require >=4 chars to avoid
  // false positives on very short slugs.
  if (a === b) return remainder
  // 3-char min lets "IBM" match "Ibm-granite" while still blocking 2-char
  // false positives. Either side may be the prefix.
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return remainder
  return name
}

// Throttle malformed-model warnings the same way arenaClient does. Without
// this, an OpenRouter schema change could spam the console with 50 identical
// warnings on every page load.
let orNormalizationWarnCount = 0
const MAX_OR_NORMALIZATION_WARNS = 3

export function normalizeOpenRouterModel(model) {
  try {
    const pricing = model.pricing || {}
    const inputPrice = priceOrNull(pricing.prompt)
    const outputPrice = priceOrNull(pricing.completion)
    const provider = extractProvider(model.id)
    const isVariablePrice = pricing.prompt != null && safeFloat(pricing.prompt) < 0

    return {
      id: safeStr(model.id, 100),
      name: safeStr(stripProviderPrefix(model.name || model.id, provider), 100),
      provider,
      providerIcon: getProviderIcon(provider),
      inputPricePerMToken: inputPrice,
      outputPricePerMToken: outputPrice,
      cachedInputPrice: inputPrice != null ? Math.round(inputPrice * 0.1 * 100) / 100 : null,
      isVariablePrice,
      contextWindow: safeFloat(model.context_length),
      contextLabel: formatContext(model.context_length),
      modalities: typeof model.architecture?.modality === 'string'
        ? model.architecture.modality.split('+').map(m => safeStr(m, 30))
        : ['text'],
      license: model.architecture?.instruct_type ? 'open' : 'proprietary',
      // Truncated description used downstream for description-augmented task
      // tagging and fuzzy search. Capped so the merged payload stays small.
      description: safeStr(model.description, 600),
      source: 'openrouter',
    }
  } catch (err) {
    // Skip malformed individual models rather than failing the whole list
    orNormalizationWarnCount += 1
    if (orNormalizationWarnCount <= MAX_OR_NORMALIZATION_WARNS) {
      console.warn(`[openRouterClient] Failed to normalize model (${orNormalizationWarnCount}):`, model?.id, err.message)
      if (orNormalizationWarnCount === MAX_OR_NORMALIZATION_WARNS) {
        console.warn(`[openRouterClient] Suppressing further normalization warnings this session.`)
      }
    }
    return null
  }
}

function extractProvider(modelId) {
  if (typeof modelId !== 'string') return 'Unknown'
  const parts = modelId.split('/')
  if (parts.length > 1) {
    // OpenRouter prefixes "auto-latest" aliases with `~` (e.g. `~openai/gpt-latest`).
    // Strip the tilde so these fold into the canonical provider.
    const raw0 = parts[0].startsWith('~') ? parts[0].slice(1) : parts[0]
    const map = {
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'google': 'Google',
      'meta-llama': 'Meta',
      'mistralai': 'Mistral',
      'cohere': 'Cohere',
      'x-ai': 'xAI',
      'qwen': 'Alibaba',
      'deepseek': 'DeepSeek',
      'nvidia': 'NVIDIA',
      'amazon': 'Amazon',
      'microsoft': 'Microsoft',
      'perplexity': 'Perplexity',
      'nousresearch': 'Nous',
      'together': 'Together',
      'fireworks': 'Fireworks',
      'groq': 'Groq',
      'huggingfaceh4': 'HuggingFace',
      'moonshotai': 'Moonshot',
      'bytedance-seed': 'ByteDance',
      'baidu': 'Baidu',
      'minimax': 'MiniMax',
      'z-ai': 'Z.ai',
      'arcee-ai': 'Arcee',
      'xiaomi': 'Xiaomi',
      'anthracite-org': 'Anthracite',
      'aion-labs': 'Aion Labs',
      'inclusionai': 'Inclusion AI',
      'liquid': 'LiquidAI',
      'rekaai': 'Reka',
      'thedrummer': 'TheDrummer',
      'tencent': 'Tencent',
      'morph': 'Morph',
      'stepfun': 'StepFun',
      'sao10k': 'Sao10K',
      'gryphe': 'Gryphe',
      'undi95': 'Undi95',
      'allenai': 'AllenAI',
      'essentialai': 'Essential AI',
      'cognitivecomputations': 'Cognitive Computations',
      'deepcogito': 'Deep Cogito',
      'ai21': 'AI21',
      'switchpoint': 'Switchpoint',
      'mancer': 'Mancer',
      'alfredpros': 'AlfredPros',
      'kwaipilot': 'Kwaipilot',
      'inflection': 'Inflection',
      'ibm-granite': 'IBM Granite',
      'prime-intellect': 'Prime Intellect',
      'inception': 'Inception',
      'poolside': 'Poolside',
      'nex-agi': 'Nex AGI',
      'perceptron': 'Perceptron',
      'relace': 'Relace',
      'writer': 'Writer',
      'upstage': 'Upstage',
      'openrouter': 'OpenRouter',
      'bytedance': 'ByteDance',
      'ai21labs': 'AI21',
    }
    // Capitalize unknown providers nicely: "sao10k" → "Sao10k". For multi-
    // segment names like "some-provider-org" → "Some Provider".
    if (map[raw0]) return map[raw0]
    const safe = safeStr(raw0, 30)
      .split(/[-_]/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    return safe || raw0
  }
  return 'Unknown'
}

function getProviderIcon(provider) {
  return getProviderVisual(provider).icon
}

function formatContext(ctx) {
  const n = safeFloat(ctx)
  if (!n) return '?'
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return n.toString()
}
