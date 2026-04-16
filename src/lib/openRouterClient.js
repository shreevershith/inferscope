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

export function normalizeOpenRouterModel(model) {
  try {
    const pricing = model.pricing || {}
    const inputPrice = safeFloat(pricing.prompt) * 1_000_000
    const outputPrice = safeFloat(pricing.completion) * 1_000_000
    const provider = extractProvider(model.id)

    return {
      id: safeStr(model.id, 100),
      name: safeStr(model.name || model.id, 100),
      provider,
      providerIcon: getProviderIcon(provider),
      inputPricePerMToken: Math.round(inputPrice * 100) / 100,
      outputPricePerMToken: Math.round(outputPrice * 100) / 100,
      cachedInputPrice: Math.round(inputPrice * 0.1 * 100) / 100,
      contextWindow: safeFloat(model.context_length),
      contextLabel: formatContext(model.context_length),
      modalities: typeof model.architecture?.modality === 'string'
        ? model.architecture.modality.split('+').map(m => safeStr(m, 30))
        : ['text'],
      license: model.architecture?.instruct_type ? 'open' : 'proprietary',
      source: 'openrouter',
    }
  } catch (err) {
    // Skip malformed individual models rather than failing the whole list
    console.warn('Failed to normalize OpenRouter model:', model?.id, err.message)
    return null
  }
}

function extractProvider(modelId) {
  if (typeof modelId !== 'string') return 'Unknown'
  const parts = modelId.split('/')
  if (parts.length > 1) {
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
    }
    return map[parts[0]] || safeStr(parts[0], 30)
  }
  return 'Unknown'
}

function getProviderIcon(provider) {
  const icons = {
    'OpenAI': 'cloud',
    'Anthropic': 'cognition',
    'Google': 'language',
    'Meta': 'hub',
    'Mistral': 'waves',
    'Cohere': 'dynamic_form',
    'xAI': 'smart_toy',
    'Alibaba': 'translate',
    'DeepSeek': 'explore',
  }
  return icons[provider] || 'smart_toy'
}

function formatContext(ctx) {
  const n = safeFloat(ctx)
  if (!n) return '?'
  if (n >= 1000000) return `${(n / 1000000).toFixed(0)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`
  return n.toString()
}
