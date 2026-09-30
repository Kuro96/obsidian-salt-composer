import { SettingMigration } from '../setting.types'

import { DefaultChatModels, getMigratedChatModels } from './migrationUtils'

const DEFAULT_CHAT_MODELS_V21: DefaultChatModels = [
  'gpt-6.1-sol',
  'gpt-6-astra',
  'gpt-6-sol',
  'gpt-6-luna',
].flatMap((baseModel) =>
  ['', '-fast'].map((suffix) => {
    const model = `${baseModel}${suffix}`
    return {
      providerType: 'openai-plan',
      providerId: 'openai-plan',
      id: `${model} (plan)`,
      model,
      reasoning: {
        reasoning_effort: baseModel === 'gpt-6-astra' ? 'medium' : 'high',
        reasoning_summary: 'auto',
      },
    }
  }),
)

const INVALID_PRESET_IDS = new Set(
  ['gpt-6-terra', 'gpt-6.1-terra', 'gpt-6.1-luna'].flatMap((model) => [
    `${model} (plan)`,
    `${model}-fast (plan)`,
  ]),
)

export const migrateFrom20To21: SettingMigration['migrate'] = (data) => {
  const chatModels = (
    getMigratedChatModels(data, DEFAULT_CHAT_MODELS_V21) as DefaultChatModels
  ).filter(
    (model) =>
      model.providerType !== 'openai-plan' ||
      model.providerId !== 'openai-plan' ||
      !INVALID_PRESET_IDS.has(model.id),
  )
  return {
    ...data,
    version: 21,
    chatModels,
    chatModelId: chatModels.some((model) => model.id === data.chatModelId)
      ? data.chatModelId
      : 'gpt-6.1-sol (plan)',
  }
}
