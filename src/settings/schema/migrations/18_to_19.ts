import { SettingMigration } from '../setting.types'

import { DefaultChatModels, getMigratedChatModels } from './migrationUtils'

const DEFAULT_CHAT_MODEL_ID_V19 = 'gpt-5.6-sol (plan)'
const GPT_5_6_CHAT_MODELS_V19: DefaultChatModels = [
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: DEFAULT_CHAT_MODEL_ID_V19,
    model: 'gpt-5.6-sol',
    reasoning: {
      reasoning_effort: 'low',
      reasoning_summary: 'auto',
    },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-sol-fast (plan)',
    model: 'gpt-5.6-sol-fast',
    reasoning: {
      reasoning_effort: 'low',
      reasoning_summary: 'auto',
    },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-terra (plan)',
    model: 'gpt-5.6-terra',
    reasoning: {
      reasoning_effort: 'medium',
      reasoning_summary: 'auto',
    },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-terra-fast (plan)',
    model: 'gpt-5.6-terra-fast',
    reasoning: {
      reasoning_effort: 'medium',
      reasoning_summary: 'auto',
    },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-luna (plan)',
    model: 'gpt-5.6-luna',
    reasoning: {
      reasoning_effort: 'medium',
      reasoning_summary: 'auto',
    },
  },
  {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'gpt-5.6-luna-fast (plan)',
    model: 'gpt-5.6-luna-fast',
    reasoning: {
      reasoning_effort: 'medium',
      reasoning_summary: 'auto',
    },
  },
]

export const migrateFrom18To19: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 19
  newData.chatModels = getMigratedChatModels(newData, GPT_5_6_CHAT_MODELS_V19)

  if (newData.chatModelId === 'gpt-5.5 (plan)') {
    newData.chatModelId = DEFAULT_CHAT_MODEL_ID_V19
  }

  return newData
}
