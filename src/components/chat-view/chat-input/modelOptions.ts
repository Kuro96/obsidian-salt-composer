import { ChatModel } from '../../../types/chat-model.types'

const CODEX_MODEL_PATTERN =
  /^(gpt-6-(?:astra|sol|luna)|gpt-6\.1-sol)(?:-fast)?$/
const CURRENT_CODEX_REASONING_EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const
const CODEX_REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const
const OPENAI_REASONING_EFFORTS = ['low', 'medium', 'high'] as const

export type ReasoningEffortOption =
  | (typeof CURRENT_CODEX_REASONING_EFFORTS)[number]
  | (typeof CODEX_REASONING_EFFORTS)[number]
  | (typeof OPENAI_REASONING_EFFORTS)[number]

export function getReasoningEffortOptions(
  model: ChatModel,
): readonly ReasoningEffortOption[] {
  if (model.providerType === 'openai-plan') {
    return CODEX_MODEL_PATTERN.test(model.model)
      ? CURRENT_CODEX_REASONING_EFFORTS
      : CODEX_REASONING_EFFORTS
  }
  if (model.providerType === 'openai' && model.reasoning?.enabled) {
    return OPENAI_REASONING_EFFORTS
  }
  return []
}

export function getCodexFastModelName(
  model: ChatModel,
  enabled: boolean,
): string | undefined {
  if (model.providerType !== 'openai-plan') return undefined
  const match = CODEX_MODEL_PATTERN.exec(model.model)
  if (!match) return undefined
  return `${match[1]}${enabled ? '-fast' : ''}`
}

export function getCodexFastModelPair(
  models: readonly ChatModel[],
  selectedModel: ChatModel,
): { normal: ChatModel; fast: ChatModel } | undefined {
  const normalModelName = getCodexFastModelName(selectedModel, false)
  const fastModelName = getCodexFastModelName(selectedModel, true)
  if (!normalModelName || !fastModelName) return undefined

  const normalModels = models.filter(
    (model) =>
      model.providerId === selectedModel.providerId &&
      (model.enable ?? true) &&
      model.model === normalModelName,
  )
  const fastModels = models.filter(
    (model) =>
      model.providerId === selectedModel.providerId &&
      (model.enable ?? true) &&
      model.model === fastModelName,
  )
  if (normalModels.length !== 1 || fastModels.length !== 1) return undefined

  return { normal: normalModels[0], fast: fastModels[0] }
}
