// UI-only visual mapping. Maps a canonical provider name → icon glyph and
// homepage URL. These are not business/pricing data — they're UI assets that
// don't change as providers evolve. All real data (model counts, price ranges,
// model lists) is derived live from OpenRouter via deriveProviders().
//
// New providers fall back to a generic icon + null URL when not in this map.

const PROVIDER_VISUALS = {
  'OpenAI':       { icon: 'auto_awesome',         url: 'https://openai.com' },
  'Anthropic':    { icon: 'psychology',           url: 'https://anthropic.com' },
  'Google':       { icon: 'language',             url: 'https://ai.google' },
  'Meta':         { icon: 'hub',                  url: 'https://ai.meta.com' },
  'Mistral':      { icon: 'air',                  url: 'https://mistral.ai' },
  'Cohere':       { icon: 'dynamic_form',         url: 'https://cohere.com' },
  'xAI':          { icon: 'smart_toy',            url: 'https://x.ai' },
  'Alibaba':      { icon: 'translate',            url: 'https://www.alibabacloud.com' },
  'DeepSeek':     { icon: 'explore',              url: 'https://www.deepseek.com' },
  'Perplexity':   { icon: 'search',               url: 'https://perplexity.ai' },
  'NVIDIA':       { icon: 'memory',               url: 'https://www.nvidia.com' },
  'Microsoft':    { icon: 'shield',               url: 'https://microsoft.com' },
  'Amazon':       { icon: 'cloud',                url: 'https://aws.amazon.com' },
  'Nous':         { icon: 'travel_explore',       url: 'https://nousresearch.com' },
  'Together':     { icon: 'hub',                  url: 'https://together.ai' },
  'Fireworks':    { icon: 'local_fire_department',url: 'https://fireworks.ai' },
  'Groq':         { icon: 'bolt',                 url: 'https://groq.com' },
  'HuggingFace':  { icon: 'smart_toy',            url: 'https://huggingface.co' },
}

export function getProviderVisual(name) {
  return PROVIDER_VISUALS[name] || { icon: 'smart_toy', url: null }
}

/**
 * Derive the live provider catalog from the merged model list (OpenRouter
 * pricing + Arena ELO). Groups models by provider, computes price range,
 * counts open vs proprietary models, and surfaces top ELO per provider.
 */
export function deriveProviders(modelList) {
  if (!Array.isArray(modelList) || modelList.length === 0) return []

  const groups = new Map()
  for (const model of modelList) {
    const provider = model.provider || 'Unknown'
    if (!groups.has(provider)) {
      groups.set(provider, {
        name: provider,
        models: 0,
        openModels: 0,
        freeModels: 0,
        pricedModels: 0,
        variableModels: 0,
        inputPrices: [],
        outputPrices: [],
        topElo: 0,
        topModelName: null,
      })
    }
    const g = groups.get(provider)
    g.models += 1
    if (model.license === 'open') g.openModels += 1

    const inP = model.inputPricePerMToken
    const outP = model.outputPricePerMToken
    if (model.isVariablePrice || inP == null || outP == null) {
      g.variableModels += 1
    } else if (inP === 0 && outP === 0) {
      g.freeModels += 1
    } else {
      g.pricedModels += 1
      if (Number.isFinite(inP) && inP > 0) g.inputPrices.push(inP)
      if (Number.isFinite(outP) && outP > 0) g.outputPrices.push(outP)
    }

    if ((model.arenaElo || 0) > g.topElo) {
      g.topElo = model.arenaElo
      g.topModelName = model.name
    }
  }

  return Array.from(groups.values())
    .filter(g => g.models > 0)
    .map(g => {
      const visual = getProviderVisual(g.name)
      const minInput = g.inputPrices.length ? Math.min(...g.inputPrices) : 0
      const maxOutput = g.outputPrices.length ? Math.max(...g.outputPrices) : 0
      // Pick the most honest label given which buckets a provider falls into.
      let priceRange
      if (g.pricedModels > 0 && minInput > 0 && maxOutput > 0) {
        priceRange = `$${minInput.toFixed(2)} - $${maxOutput.toFixed(2)}`
      } else if (g.freeModels === g.models) {
        priceRange = 'Free'
      } else if (g.variableModels === g.models) {
        priceRange = 'Variable (routed)'
      } else if (g.freeModels + g.variableModels === g.models) {
        priceRange = 'Free / routed'
      } else {
        priceRange = '—'
      }
      return {
        id: g.name.toLowerCase().replace(/\s+/g, '-'),
        name: g.name,
        icon: visual.icon,
        url: visual.url,
        models: g.models,
        openModels: g.openModels,
        freeModels: g.freeModels,
        priceRange,
        minInputPrice: minInput,
        maxOutputPrice: maxOutput,
        topElo: g.topElo || null,
        topModelName: g.topModelName,
      }
    })
    .sort((a, b) => (b.topElo || 0) - (a.topElo || 0) || b.models - a.models)
}
