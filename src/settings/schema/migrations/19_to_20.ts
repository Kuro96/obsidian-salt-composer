import { SettingMigration } from '../setting.types'

import { DefaultChatModels, getMigratedChatModels } from './migrationUtils'

const DEFAULT_CHAT_MODEL_ID_V20 = 'gpt-6.1-sol (plan)'
const DEFAULT_CHAT_MODELS_V20: DefaultChatModels = ['6.1', '6'].flatMap(
  (version) =>
    ['sol', 'terra', 'luna'].flatMap((submodel) =>
      ['', '-fast'].map((suffix) => {
        const model = `gpt-${version}-${submodel}${suffix}`
        return {
          providerType: 'openai-plan',
          providerId: 'openai-plan',
          id: `${model} (plan)`,
          model,
          reasoning: {
            reasoning_effort: submodel === 'sol' ? 'low' : 'medium',
            reasoning_summary: 'auto',
          },
        }
      }),
    ),
)

const RETIRED_MODEL_IDS = new Set([
  'gpt-5.2 (plan)',
  'gpt-5.3-codex (plan)',
  'gpt-5.4 (plan)',
  'gpt-5.5 (plan)',
  ...['sol', 'terra', 'luna'].flatMap((submodel) => [
    `gpt-5.6-${submodel} (plan)`,
    `gpt-5.6-${submodel}-fast (plan)`,
  ]),
])

export const migrateFrom19To20: SettingMigration['migrate'] = (data) => {
  const newData = { ...data, version: 20 }
  const chatModels = (
    getMigratedChatModels(newData, DEFAULT_CHAT_MODELS_V20) as DefaultChatModels
  ).filter(
    (model) =>
      model.providerType !== 'openai-plan' ||
      model.providerId !== 'openai-plan' ||
      !RETIRED_MODEL_IDS.has(model.id),
  )
  return {
    ...newData,
    chatModels,
    chatModelId: chatModels.some((model) => model.id === data.chatModelId)
      ? data.chatModelId
      : DEFAULT_CHAT_MODEL_ID_V20,
  }
}
