import { SettingMigration } from '../setting.types'

import { DEFAULT_CHAT_MODELS_V15 } from './14_to_15'
import { getMigratedChatModels, getMigratedProviders } from './migrationUtils'

const DEFAULT_PROVIDERS_V16 = [
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

const DEFAULT_CHAT_MODELS_V16 = DEFAULT_CHAT_MODELS_V15

export const migrateFrom15To16: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 16

  newData.providers = getMigratedProviders(newData, DEFAULT_PROVIDERS_V16)
  newData.chatModels = getMigratedChatModels(newData, DEFAULT_CHAT_MODELS_V16)

  return newData
}
