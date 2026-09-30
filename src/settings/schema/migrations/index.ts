import type { ZodTypeAny } from 'zod'

import {
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_PROVIDERS,
} from '../../../constants'
import { chatModelSchema } from '../../../types/chat-model.types'
import { embeddingModelSchema } from '../../../types/embedding-model.types'
import { llmProviderSchema } from '../../../types/provider.types'

import { RETIRED_CHAT_MODEL_IDS } from './retired-models'

type SettingsRecord = Record<string, unknown>

function record(value: unknown): SettingsRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SettingsRecord)
    : {}
}

function records(value: unknown): SettingsRecord[] {
  return Array.isArray(value) ? value.map((item) => ({ ...record(item) })) : []
}

function mergeDefaults(
  existing: SettingsRecord[],
  defaults: readonly { id: string }[],
  schema: ZodTypeAny,
): SettingsRecord[] {
  return [
    ...defaults.map((item) => ({
      ...(existing.find(
        (value) => value.id === item.id && schema.safeParse(value).success,
      ) ?? item),
    })),
    ...existing.filter(
      (item) => !defaults.some((value) => value.id === item.id),
    ),
  ]
}

/** Convert legacy field shapes and fill missing presets. No version ordering;
 * repeating this migration preserves the user's current settings. */
export function migrateSettings(input: unknown): SettingsRecord {
  const data = { ...record(input) }
  const providers = records(data.providers)
  let chatModels = records(data.chatModels)
  let retiredSelection =
    data.chatModels === undefined &&
    typeof data.chatModelId === 'string' &&
    RETIRED_CHAT_MODEL_IDS.has(data.chatModelId)

  const apiKeys = {
    openai: 'openAIApiKey',
    anthropic: 'anthropicApiKey',
    gemini: 'geminiApiKey',
    groq: 'groqApiKey',
  }
  for (const [type, key] of Object.entries(apiKeys)) {
    if (typeof data[key] !== 'string' || !data[key]) continue
    const provider = providers.find((item) => item.id === type)
    if (provider) {
      provider.apiKey ??= data[key]
    } else {
      providers.push({ id: type, type, apiKey: data[key] })
    }
  }

  const ensureProvider = (type: string, baseUrl: string, apiKey?: string) => {
    const existing = providers.find(
      (item) =>
        item.type === type &&
        (item.baseUrl ?? '') === baseUrl &&
        (type === 'ollama' || (item.apiKey ?? '') === (apiKey ?? '')),
    )
    if (existing) return existing.id as string
    const prefix = type === 'ollama' ? 'ollama' : 'custom'
    let id = prefix
    let count = 1
    while (providers.some((item) => item.id === id) || id === 'custom')
      id = `${prefix}-${count++}`
    providers.push({
      id,
      type,
      baseUrl,
      ...(apiKey !== undefined ? { apiKey } : {}),
    })
    return id
  }

  const ollamaEmbedding = record(data.ollamaEmbeddingModel)
  const ollamaChat = record(data.ollamaChatModel)
  const ollamaApply = record(data.ollamaApplyModel)
  const defaultOllamaUrl =
    ollamaEmbedding.baseUrl ||
    ollamaChat.baseUrl ||
    ollamaApply.baseUrl ||
    data.ollamaBaseUrl
  if (typeof defaultOllamaUrl === 'string' && defaultOllamaUrl) {
    ensureProvider('ollama', defaultOllamaUrl)
  }
  for (const [field, type, selected] of [
    ['ollamaChatModel', 'ollama', true],
    ['ollamaApplyModel', 'ollama', false],
    ['openAICompatibleChatModel', 'openai-compatible', true],
    ['openAICompatibleApplyModel', 'openai-compatible', false],
  ] as const) {
    const config = record(data[field])
    const baseUrl =
      config.baseUrl || (type === 'ollama' ? defaultOllamaUrl : undefined)
    if (typeof baseUrl !== 'string' || !baseUrl) continue
    const providerId = ensureProvider(
      type,
      baseUrl,
      typeof config.apiKey === 'string' ? config.apiKey : undefined,
    )
    if (typeof config.model !== 'string' || !config.model) continue
    const existing = chatModels.find(
      (item) => item.providerId === providerId && item.model === config.model,
    )
    const id = existing?.id ?? `${providerId}/${config.model}`
    if (!existing)
      chatModels.push({
        id,
        providerType: type,
        providerId,
        model: config.model,
      })
    if (
      selected &&
      (data.chatModelId === type ||
        (type === 'ollama' && data.chatModel === 'llama3.1:8b'))
    )
      data.chatModelId = id
  }

  const legacyEndpoints: Record<string, string> = {
    groq: 'https://api.groq.com/openai/v1',
    morph: 'https://api.morphllm.com/v1',
  }
  for (const provider of providers) {
    const endpoint = legacyEndpoints[String(provider.type)]
    if (endpoint) {
      provider.type = 'openai-compatible'
      provider.baseUrl ||= endpoint
    }
  }
  chatModels = chatModels
    .map((model) => {
      if (legacyEndpoints[String(model.providerType)])
        model.providerType = 'openai-compatible'
      if (
        model.providerType === 'openai' &&
        typeof model.reasoning_effort === 'string'
      ) {
        model.reasoning = {
          enabled: true,
          reasoning_effort: model.reasoning_effort,
          ...record(model.reasoning),
        }
        delete model.reasoning_effort
      }
      if (model.providerType === 'openai') delete model.streamingDisabled
      const thinking = record(model.thinking)
      if (
        model.providerType === 'anthropic' &&
        typeof thinking.budget_tokens === 'number' &&
        thinking.enabled === undefined
      ) {
        model.thinking = { ...thinking, enabled: true }
      }
      return model
    })
    .filter((model) => {
      const defaultProvider = DEFAULT_PROVIDERS.some(
        (provider) =>
          provider.id === model.providerId &&
          provider.type === model.providerType,
      )
      const retired =
        defaultProvider && RETIRED_CHAT_MODEL_IDS.has(String(model.id))
      if (retired && model.id === data.chatModelId) retiredSelection = true
      return !retired
    })

  data.providers = mergeDefaults(
    providers,
    DEFAULT_PROVIDERS,
    llmProviderSchema,
  )
  data.chatModels = mergeDefaults(
    chatModels,
    DEFAULT_CHAT_MODELS,
    chatModelSchema,
  )
  data.embeddingModels = mergeDefaults(
    records(data.embeddingModels),
    DEFAULT_EMBEDDING_MODELS,
    embeddingModelSchema,
  )
  if (
    typeof data.chatModelId !== 'string' ||
    (retiredSelection &&
      !(data.chatModels as SettingsRecord[]).some(
        (model) => model.id === data.chatModelId,
      ))
  ) {
    data.chatModelId = DEFAULT_CHAT_MODEL_ID
  }
  if (
    typeof data.embeddingModelId !== 'string' &&
    typeof data.embeddingModel === 'string'
  ) {
    data.embeddingModelId = DEFAULT_EMBEDDING_MODELS.find(
      (model) => model.model === data.embeddingModel,
    )?.id
  }

  const obsoleteFields = new Set([
    'version',
    'chatModel',
    'applyModel',
    'applyModelId',
    'embeddingModel',
    'systemPrompt',
    ...Object.values(apiKeys),
    'ollamaBaseUrl',
    'ollamaChatModel',
    'ollamaApplyModel',
    'ollamaEmbeddingModel',
    'openAICompatibleChatModel',
    'openAICompatibleApplyModel',
  ])
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !obsoleteFields.has(key)),
  )
}
