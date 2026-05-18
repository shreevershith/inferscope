import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const useDashboardStore = create(
  subscribeWithSelector((set, get) => ({
    // ── Models Slice ──
    modelList: [],
    modelsLoading: false,
    modelsLastFetched: null,
    // fetchedAt is the actual upstream fetch time (passed from useModelData).
    // Falls back to "now" when called without one so the timestamp is never
    // null after the first store update.
    setModelList: (models, fetchedAt) => set({
      modelList: models,
      modelsLastFetched: fetchedAt || new Date().toISOString(),
    }),
    setModelsLoading: (loading) => set({ modelsLoading: loading }),

    // ── Pricing Slice ──
    pricingMap: {},
    providers: [],
    setPricingMap: (map) => set({ pricingMap: map }),
    setProviders: (providers) => set({ providers }),

    // ── Calculator Slice ──
    // Pricing fields start at 0 — they only populate once a live model is
    // selected (from Arena or directly). The UI shows "Select a model" until
    // then. Tokens/requests are UI defaults, not pricing data.
    calculatorInputs: {
      selectedModelId: null,
      selectedModelName: '',
      inputTokens: 500,
      outputTokens: 200,
      requestsPerDay: 1000,
      cachingHitRate: 30,
      scenario: 'base', // 'low' | 'base' | 'high' | 'spike'
      // Per-user multiplier overrides keyed by scenario id. Empty by default;
      // a value here wins over the SCENARIO_MULTIPLIERS constant.
      scenarioOverrides: {},
      inputPricePerMToken: 0,
      outputPricePerMToken: 0,
      cachedInputPrice: 0,
    },
    selectedProvider: null,
    setCalculatorInputs: (inputs) => set((state) => ({
      calculatorInputs: { ...state.calculatorInputs, ...inputs }
    })),
    setSelectedProvider: (provider) => set({ selectedProvider: provider }),

    // Cross-tab: Arena → Calculator
    applyModelToCalculator: (model) => set((state) => ({
      calculatorInputs: {
        ...state.calculatorInputs,
        selectedModelId: model.id,
        selectedModelName: model.name,
        inputPricePerMToken: model.inputPricePerMToken || state.calculatorInputs.inputPricePerMToken,
        outputPricePerMToken: model.outputPricePerMToken || state.calculatorInputs.outputPricePerMToken,
        cachedInputPrice: model.cachedInputPrice || state.calculatorInputs.cachedInputPrice,
      }
    })),

    // Cross-tab: Infra → Calculator
    applyProviderToCalculator: (provider) => set({
      selectedProvider: provider,
    }),

    // ── Advisor Slice ──
    chatMessages: [],
    isChatLoading: false,
    aiProvider: 'claude',
    isPanelOpen: false,
    addChatMessage: (msg) => set((state) => ({
      chatMessages: [...state.chatMessages, {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...msg,
      }]
    })),
    setChatLoading: (loading) => set({ isChatLoading: loading }),
    setAiProvider: (provider) => set({ aiProvider: provider }),
    toggleAdvisorPanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
    setAdvisorPanelOpen: (open) => set({ isPanelOpen: open }),
    clearChat: () => set({ chatMessages: [] }),

    // ── UI Slice ──
    theme: 'dark',
    activeTab: 0,
    compareModels: [],
    setTheme: (theme) => set({ theme }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    toggleCompareModel: (modelId) => set((state) => {
      const exists = state.compareModels.includes(modelId)
      if (exists) {
        return { compareModels: state.compareModels.filter(id => id !== modelId) }
      }
      if (state.compareModels.length >= 3) return state
      return { compareModels: [...state.compareModels, modelId] }
    }),
    clearCompareModels: () => set({ compareModels: [] }),

    // ── Tour Slice ──
    tourChapter: null,  // 'A' | 'B' | 'C' | 'D' | null
    tourStep: 0,
    startChapter: (chapter) => set({ tourChapter: chapter, tourStep: 0 }),
    endChapter: () => set({ tourChapter: null, tourStep: 0 }),
    nextStep: () => set((state) => ({ tourStep: state.tourStep + 1 })),
    prevStep: () => set((state) => ({ tourStep: Math.max(0, state.tourStep - 1) })),
    goToStep: (step) => set({ tourStep: Math.max(0, step) }),

    // ── Advisor Context Aggregator ──
    getAdvisorContext: () => {
      const state = get()

      // Format a single price field, handling routed/free/unknown explicitly
      // so we never ship "$null" or "$0/$0" to the LLM.
      const fmtPrice = (v, isVariable) => {
        if (isVariable) return 'variable'
        if (v == null) return '—'
        if (v === 0) return 'free'
        return `$${v.toFixed(2)}`
      }

      // Top 10 priced, non-variable models so the LLM gets a clean, scannable
      // leaderboard rather than 350 lines including routers and free demos.
      const topModels = state.modelList
        .filter(m => !m.isVariablePrice && Number.isFinite(m.inputPricePerMToken))
        .slice(0, 10)
        .map(m => {
          const elo = m.arenaElo ? `ELO ${m.arenaElo}` : 'no ELO'
          const inP = fmtPrice(m.inputPricePerMToken, m.isVariablePrice)
          const outP = fmtPrice(m.outputPricePerMToken, m.isVariablePrice)
          const ctx = m.contextLabel || '—'
          return `${m.name} (${m.provider}, ${elo}, ${inP} in / ${outP} out per M tok, ${ctx} ctx)`
        })
        .join('\n')

      const calc = state.calculatorInputs
      let calcContext
      let monthlyCostEstimate = null
      if (calc.selectedModelId) {
        // Project monthly cost so the LLM can ground recommendations in real numbers.
        const reqMo = (calc.requestsPerDay || 0) * 30
        const inMo = reqMo * (calc.inputTokens || 0)
        const outMo = reqMo * (calc.outputTokens || 0)
        const cacheRate = (calc.cachingHitRate || 0) / 100
        const inputCost = (inMo / 1_000_000) * (
          (calc.inputPricePerMToken || 0) * (1 - cacheRate) +
          (calc.cachedInputPrice || 0) * cacheRate
        )
        const outputCost = (outMo / 1_000_000) * (calc.outputPricePerMToken || 0)
        const monthly = inputCost + outputCost
        monthlyCostEstimate = monthly >= 1000
          ? `$${(monthly / 1000).toFixed(1)}K/mo`
          : `$${monthly.toFixed(2)}/mo`

        calcContext = [
          `Selected: ${calc.selectedModelName}`,
          `Pricing: ${fmtPrice(calc.inputPricePerMToken)} in / ${fmtPrice(calc.outputPricePerMToken)} out per M tokens`,
          `Volume: ${(calc.requestsPerDay || 0).toLocaleString()} req/day, ${calc.inputTokens || 0} in + ${calc.outputTokens || 0} out tokens/req`,
          `Cache hit rate: ${calc.cachingHitRate || 0}%`,
          `Traffic scenario: ${calc.scenario || 'base'}`,
          `Projected monthly cost: ${monthlyCostEstimate}`,
        ].join('. ')
      } else {
        calcContext = 'No model selected in calculator yet'
      }

      return {
        topModels,
        calculatorContext: calcContext,
        monthlyCostEstimate,
        selectedProvider: state.selectedProvider?.name || 'None',
        totalModels: state.modelList.length,
      }
    },
  }))
)

export default useDashboardStore
