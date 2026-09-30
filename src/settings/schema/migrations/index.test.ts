import { DEFAULT_CHAT_MODEL_ID } from '../../../constants'
import { parseSmartComposerSettings } from '../settings'

import { migrateSettings } from './index'

it('preserves current credentials, model overrides and settings across repeated loads', () => {
  const defaults = parseSmartComposerSettings({})
  const input = {
    ...defaults,
    version: 21,
    vaultChatEnabled: false,
    providers: defaults.providers.map((provider) =>
      provider.type === 'openai-plan'
        ? {
            ...provider,
            oauth: {
              accessToken: 'access',
              refreshToken: 'refresh',
              expiresAt: 123,
              accountId: 'account',
            },
          }
        : provider,
    ),
    chatModels: defaults.chatModels.map((model) =>
      model.id === DEFAULT_CHAT_MODEL_ID
        ? {
            ...model,
            enable: false,
            reasoning: {
              reasoning_effort: 'xhigh',
              reasoning_summary: 'detailed',
            },
          }
        : model.id === 'gpt-6-astra (plan)'
          ? { ...model, reasoning: undefined }
          : model,
    ),
    mcp: {
      servers: [],
      builtin: { toolOptions: { web_search: { enabled: false } } },
    },
  }
  const result = parseSmartComposerSettings(input)
  expect(result.providers).toEqual(input.providers)
  expect(result.chatModels).toEqual(input.chatModels)
  expect(result.vaultChatEnabled).toBe(false)
  expect(result.mcp.builtin?.toolOptions.web_search.enabled).toBe(false)
  expect(result).not.toHaveProperty('version')
  expect(
    parseSmartComposerSettings(JSON.parse(JSON.stringify(result))),
  ).toEqual(result)
  expect(input.version).toBe(21)
})

it('moves flat credentials and local/custom model configs to the current shape without duplicates', () => {
  const result = parseSmartComposerSettings({
    openAIApiKey: 'openai-key',
    anthropicApiKey: 'anthropic-key',
    groqApiKey: 'groq-key',
    chatModelId: 'ollama',
    ollamaEmbeddingModel: { baseUrl: 'http://embedding.local:11434' },
    ollamaChatModel: {
      baseUrl: 'http://chat.local:11434',
      model: 'local-model',
    },
    ollamaApplyModel: {
      baseUrl: 'http://chat.local:11434',
      model: 'local-model',
    },
    openAICompatibleChatModel: {
      baseUrl: 'https://custom.example/v1',
      apiKey: 'custom-key',
      model: 'custom-model',
    },
    openAICompatibleApplyModel: {
      baseUrl: 'https://custom.example/v1',
      apiKey: 'custom-key',
      model: 'custom-model',
    },
    embeddingModel: 'nomic-embed-text',
    ragOptions: {
      excludePatterns: ['private/**'],
      includePatterns: ['notes/**'],
    },
  })
  expect(result.providers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'openai', apiKey: 'openai-key' }),
      expect.objectContaining({ id: 'anthropic', apiKey: 'anthropic-key' }),
      expect.objectContaining({
        id: 'groq',
        type: 'openai-compatible',
        apiKey: 'groq-key',
        baseUrl: 'https://api.groq.com/openai/v1',
      }),
      expect.objectContaining({
        id: 'ollama',
        baseUrl: 'http://embedding.local:11434',
      }),
    ]),
  )
  const localModels = result.chatModels.filter(
    (model) => model.model === 'local-model',
  )
  expect(localModels).toHaveLength(1)
  expect(result.chatModelId).toBe(localModels[0].id)
  expect(
    result.chatModels.filter((model) => model.model === 'custom-model'),
  ).toHaveLength(1)
  expect(
    result.providers.find(
      (provider) => provider.baseUrl === 'https://custom.example/v1',
    )?.apiKey,
  ).toBe('custom-key')
  expect(result.embeddingModelId).toBe('ollama/nomic-embed-text')
  expect(result.ragOptions.excludePatterns).toEqual(['private/**'])
  expect(parseSmartComposerSettings(result)).toEqual(result)
})

it('converts legacy reasoning and provider shapes while preserving custom model choices', () => {
  const result = parseSmartComposerSettings({
    providers: [
      { id: 'custom-openai', type: 'openai', apiKey: 'key' },
      { id: 'custom-anthropic', type: 'anthropic', apiKey: 'key' },
      { id: 'custom-groq', type: 'groq', apiKey: 'groq-key' },
    ],
    chatModels: [
      {
        id: 'custom-reasoning',
        providerId: 'custom-openai',
        providerType: 'openai',
        model: 'o1',
        reasoning_effort: 'high',
        streamingDisabled: true,
      },
      {
        id: 'custom-thinking',
        providerId: 'custom-anthropic',
        providerType: 'anthropic',
        model: 'claude',
        thinking: { budget_tokens: 4096 },
      },
      {
        id: 'custom-groq-model',
        providerId: 'custom-groq',
        providerType: 'groq',
        model: 'local-model',
      },
    ],
    chatModelId: 'custom-reasoning',
  })
  expect(result.chatModelId).toBe('custom-reasoning')
  expect(result.chatModels).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'custom-reasoning',
        reasoning: { enabled: true, reasoning_effort: 'high' },
      }),
      expect.objectContaining({
        id: 'custom-thinking',
        thinking: { enabled: true, budget_tokens: 4096 },
      }),
      expect.objectContaining({
        id: 'custom-groq-model',
        providerType: 'openai-compatible',
      }),
    ]),
  )
  expect(parseSmartComposerSettings(result)).toEqual(result)
})

it('removes retired built-in presets but retains matching IDs owned by custom providers', () => {
  const builtin = {
    id: 'gpt-6.1-terra-fast (plan)',
    providerId: 'openai-plan',
    providerType: 'openai-plan',
    model: 'gpt-6.1-terra-fast',
  }
  const custom = { ...builtin, providerId: 'custom-plan' }
  const result = migrateSettings({
    chatModels: [builtin, custom],
    chatModelId: custom.id,
  })
  expect(result.chatModels).toContainEqual(custom)
  expect(result.chatModels).not.toContainEqual(builtin)
  expect(result.chatModelId).toBe(custom.id)
  expect(
    migrateSettings({ chatModels: [builtin], chatModelId: builtin.id })
      .chatModelId,
  ).toBe(DEFAULT_CHAT_MODEL_ID)
})
