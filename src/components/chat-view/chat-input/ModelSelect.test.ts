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
  it.each(['sol', 'terra', 'luna'])(
    'should expose GPT-5.6 %s reasoning efforts',
    (submodel) => {
      expect(
        getReasoningEffortOptions(planModel(`gpt-5.6-${submodel}`)),
      ).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
    },
  )

  it('should resolve normal and fast GPT-5.6 model names', () => {
    const model = planModel('gpt-5.6-terra-fast')

    expect(getCodexFastModelName(model, false)).toBe('gpt-5.6-terra')
    expect(getCodexFastModelName(model, true)).toBe('gpt-5.6-terra-fast')
  })

  it('should not expose Fast mode for unrelated models', () => {
    expect(getCodexFastModelName(planModel('gpt-5.5'), true)).toBeUndefined()
  })

  it('should pair one normal and one fast model', () => {
    const normal = planModel('gpt-5.6-sol')
    const fast = planModel('gpt-5.6-sol-fast')

    expect(getCodexFastModelPair([normal, fast], normal)).toEqual({
      normal,
      fast,
    })
  })

  it('should reject ambiguous Fast model pairs', () => {
    const normal = planModel('gpt-5.6-sol')
    const duplicateNormal = { ...normal, id: 'custom-sol' }
    const fast = planModel('gpt-5.6-sol-fast')

    expect(
      getCodexFastModelPair([normal, duplicateNormal, fast], normal),
    ).toBeUndefined()
  })
})
