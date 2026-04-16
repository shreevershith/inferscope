const OPENROUTER_API = 'https://openrouter.ai/api/v1/models'

export async function fetchOpenRouterModels() {
  const res = await fetch(OPENROUTER_API)
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)
  const data = await res.json()
  return data.data || []
}

export function normalizeOpenRouterModel(model) {
  const pricing = model.pricing || {}
  const inputPrice = parseFloat(pricing.prompt || '0') * 1_000_000
  const outputPrice = parseFloat(pricing.completion || '0') * 1_000_000

  return {
    id: model.id,
    name: model.name || model.id,
    provider: extractProvider(model.id),
    providerIcon: getProviderIcon(extractProvider(model.id)),
    inputPricePerMToken: Math.round(inputPrice * 100) / 100,
    outputPricePerMToken: Math.round(outputPrice * 100) / 100,
    cachedInputPrice: Math.round(inputPrice * 0.1 * 100) / 100,
    contextWindow: model.context_length || 0,
    contextLabel: formatContext(model.context_length),
    modalities: model.architecture?.modality?.split('+') || ['text'],
    license: model.architecture?.instruct_type ? 'open' : 'proprietary',
    source: 'openrouter',
  }
}

function extractProvider(modelId) {
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
    return map[parts[0]] || parts[0]
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
  if (!ctx) return '?'
  if (ctx >= 1000000) return `${(ctx / 1000000).toFixed(0)}M`
  if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`
  return ctx.toString()
}
