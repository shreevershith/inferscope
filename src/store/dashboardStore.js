import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const useDashboardStore = create(
  subscribeWithSelector((set, get) => ({
    // ── Models Slice ──
    modelList: [],
    modelsLoading: false,
    modelsLastFetched: null,
    setModelList: (models) => set({ modelList: models, modelsLastFetched: new Date().toISOString() }),
    setModelsLoading: (loading) => set({ modelsLoading: loading }),

    // ── Pricing Slice ──
    pricingMap: {},
    providers: [],
    setPricingMap: (map) => set({ pricingMap: map }),
    setProviders: (providers) => set({ providers }),

    // ── Calculator Slice ──
    calculatorInputs: {
      selectedModelId: null,
      selectedModelName: '',
      inputTokens: 500,
      outputTokens: 200,
      requestsPerDay: 1000,
      cachingHitRate: 30,
      scenario: 'base', // 'low' | 'base' | 'high'
      inputPricePerMToken: 3.00,
      outputPricePerMToken: 15.00,
      cachedInputPrice: 0.30,
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

    // ── Advisor Context Aggregator ──
    getAdvisorContext: () => {
      const state = get()
      const topModels = state.modelList
        .slice(0, 10)
        .map(m => `${m.name} (ELO: ${m.arenaElo || 'N/A'}, $${m.inputPricePerMToken}/$${m.outputPricePerMToken} per M tokens)`)
        .join('\n')

      const calc = state.calculatorInputs
      const calcContext = calc.selectedModelId
        ? `Selected model: ${calc.selectedModelName}, ${calc.requestsPerDay} req/day, ${calc.inputTokens} input + ${calc.outputTokens} output tokens/req, ${calc.cachingHitRate}% cache hit rate, scenario: ${calc.scenario}`
        : 'No model selected in calculator'

      return {
        topModels,
        calculatorContext: calcContext,
        selectedProvider: state.selectedProvider?.name || 'None',
        totalModels: state.modelList.length,
      }
    },
  }))
)

export default useDashboardStore
