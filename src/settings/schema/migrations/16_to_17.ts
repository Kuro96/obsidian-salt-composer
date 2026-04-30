import { SettingMigration } from '../setting.types'

import { DEFAULT_CHAT_MODELS_V15 } from './14_to_15'
import { getMigratedChatModels, getMigratedProviders } from './migrationUtils'

const DEFAULT_PROVIDERS_V17 = [
  { type: 'openai-plan', id: 'openai-plan' },
  { type: 'anthropic', id: 'anthropic' },
  { type: 'openai', id: 'openai' },
  { type: 'gemini', id: 'gemini' },
  { type: 'xai', id: 'xai' },
  { type: 'deepseek', id: 'deepseek' },
  { type: 'mistral', id: 'mistral' },
  { type: 'perplexity', id: 'perplexity' },
  { type: 'openrouter', id: 'openrouter' },
  { type: 'ollama', id: 'ollama' },
  { type: 'lm-studio', id: 'lm-studio' },
] as const

const DEFAULT_CHAT_MODELS_V17 = [
  ...DEFAULT_CHAT_MODELS_V15.slice(0, 1),
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
    id: 'gpt-5.5 (plan)',
    model: 'gpt-5.5',
  },
  ...DEFAULT_CHAT_MODELS_V15.slice(1),
]

export const migrateFrom16To17: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 17
  newData.vaultChatEnabled = true
  newData.agents = {
    directoryName: '.agents',
    ...(typeof newData.agents === 'object' && newData.agents
      ? (newData.agents as Record<string, unknown>)
      : {}),
  }

  newData.providers = getMigratedProviders(newData, DEFAULT_PROVIDERS_V17)
  newData.chatModels = getMigratedChatModels(newData, DEFAULT_CHAT_MODELS_V17)
  delete newData.systemPrompt

  return newData
}
