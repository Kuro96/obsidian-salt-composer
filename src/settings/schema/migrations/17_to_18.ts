import { SettingMigration } from '../setting.types'

import { DefaultChatModels, getMigratedChatModels } from './migrationUtils'

const DEFAULT_CHAT_MODEL_ID_V18 = 'gpt-5.5 (plan)'
const DEFAULT_CHAT_MODELS_V18: DefaultChatModels = [
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.2 (plan)',
    model: 'gpt-5.2',
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.3-codex (plan)',
    model: 'gpt-5.3-codex',
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.4 (plan)',
    model: 'gpt-5.4',
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: DEFAULT_CHAT_MODEL_ID_V18,
    model: 'gpt-5.5',
  },
]

const RETIRED_API_DEFAULT_CHAT_MODEL_IDS = new Set([
  'anthropic/claude-3.5-sonnet-latest',
  'anthropic/claude-3.5-haiku',
  'claude-3-opus',
  'claude-3.5-haiku',
  'claude-3.5-sonnet',
  'claude-3.7-sonnet',
  'claude-3.7-sonnet-thinking',
  'claude-haiku-4.5',
  'claude-opus-4.1',
  'claude-opus-4.5',
  'claude-sonnet-4.0',
  'claude-sonnet-4.5',
  'deepseek-chat',
  'deepseek-reasoner',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini/gemini-1.5-flash',
  'gemini/gemini-1.5-pro',
  'gemini/gemini-2.0-flash',
  'gemini/gemini-2.0-flash-thinking',
  'gemini/gemini-exp-1206',
  'gemini-exp-1206',
  'gpt-4',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5.1',
  'gpt-5.2',
  'grok-4-1-fast',
  'grok-4-1-fast-non-reasoning',
  'groq/llama-3.1-70b',
  'groq/llama-3.1-70b-versatile',
  'groq/llama-3.1-8b',
  'groq/llama-3.1-8b-instant',
  'llama-3.3-70b-instruct',
  'mistral-small-latest',
  'morph-v0',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini',
  'o4-mini',
  'ollama',
  'openai-compatible',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1',
  'sonar',
  'sonar-deep-research',
  'sonar-pro',
  'sonar-reasoning',
  'sonar-reasoning-pro',
])

export const migrateFrom17To18: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 18
  const chatModels = (
    getMigratedChatModels(newData, DEFAULT_CHAT_MODELS_V18) as { id: string }[]
  ).filter(
    (chatModel: { id: string }) =>
      !RETIRED_API_DEFAULT_CHAT_MODEL_IDS.has(chatModel.id),
  )

  newData.chatModels = chatModels
  if (!chatModels.some((chatModel) => chatModel.id === newData.chatModelId)) {
    newData.chatModelId = DEFAULT_CHAT_MODEL_ID_V18
  }
  delete newData.applyModelId

  return newData
}
