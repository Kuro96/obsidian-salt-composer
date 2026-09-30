import { ChatModel } from '../../../types/chat-model.types'

import {
  getCodexFastModelName,
  getCodexFastModelPair,
  getReasoningEffortOptions,
} from './modelOptions'

const planModel = (model: string): ChatModel => ({
  providerType: 'openai-plan',
  providerId: 'openai-plan',
  id: `${model} (plan)`,
  model,
})

describe('ModelSelect model options', () => {
  it.each(['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6.1-sol'])(
    'should expose %s reasoning efforts',
    (model) => {
      expect(getReasoningEffortOptions(planModel(model))).toEqual([
        'low',
        'medium',
        'high',
        'xhigh',
        'max',
      ])
    },
  )

  it('should resolve normal and fast Astra model names', () => {
    const model = planModel('gpt-6-astra-fast')

    expect(getCodexFastModelName(model, false)).toBe('gpt-6-astra')
    expect(getCodexFastModelName(model, true)).toBe('gpt-6-astra-fast')
  })

  it('should not expose Fast mode for unrelated models', () => {
    expect(getCodexFastModelName(planModel('gpt-5.5'), true)).toBeUndefined()
  })

  it('should pair one normal and one fast model', () => {
    const normal = planModel('gpt-6.1-sol')
    const fast = planModel('gpt-6.1-sol-fast')

    expect(getCodexFastModelPair([normal, fast], normal)).toEqual({
      normal,
      fast,
    })
  })

  it('should reject ambiguous Fast model pairs', () => {
    const normal = planModel('gpt-6.1-sol')
    const duplicateNormal = { ...normal, id: 'custom-sol' }
    const fast = planModel('gpt-6.1-sol-fast')

    expect(
      getCodexFastModelPair([normal, duplicateNormal, fast], normal),
    ).toBeUndefined()
  })
})
