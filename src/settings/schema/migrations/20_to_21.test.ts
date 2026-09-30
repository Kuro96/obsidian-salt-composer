import { DEFAULT_CHAT_MODELS } from '../../../constants'

import { migrateFrom20To21 } from './20_to_21'

describe('migrateFrom20To21', () => {
  it('repairs invalid presets and applies the requested reasoning defaults', () => {
    const customModel = {
      id: 'custom-model',
      model: 'custom-model',
      providerType: 'openai-plan',
      providerId: 'openai-plan',
      reasoning: { reasoning_effort: 'low' },
    }
    const result = migrateFrom20To21({
      version: 20,
      chatModelId: 'gpt-6.1-terra-fast (plan)',
      chatModels: [
        ...['gpt-6-terra', 'gpt-6.1-terra', 'gpt-6.1-luna'].flatMap((model) =>
          ['', '-fast'].map((suffix) => ({
            id: `${model}${suffix} (plan)`,
            model: `${model}${suffix}`,
            providerType: 'openai-plan',
            providerId: 'openai-plan',
          })),
        ),
        {
          id: 'gpt-6-sol (plan)',
          model: 'gpt-6-sol',
          providerType: 'openai-plan',
          providerId: 'openai-plan',
          reasoning: { reasoning_effort: 'low' },
        },
        customModel,
      ],
    })

    expect(result.chatModels).toEqual([...DEFAULT_CHAT_MODELS, customModel])
    expect(result.chatModelId).toBe('gpt-6.1-sol (plan)')
    expect(
      DEFAULT_CHAT_MODELS.map((model) => [
        model.model,
        model.providerType === 'openai-plan'
          ? model.reasoning?.reasoning_effort
          : undefined,
      ]),
    ).toEqual([
      ['gpt-6.1-sol', 'high'],
      ['gpt-6.1-sol-fast', 'high'],
      ['gpt-6-astra', 'medium'],
      ['gpt-6-astra-fast', 'medium'],
      ['gpt-6-sol', 'high'],
      ['gpt-6-sol-fast', 'high'],
      ['gpt-6-luna', 'high'],
      ['gpt-6-luna-fast', 'high'],
    ])
  })

  it('preserves a valid selected model', () => {
    expect(
      migrateFrom20To21({ version: 20, chatModelId: 'gpt-6-sol (plan)' })
        .chatModelId,
    ).toBe('gpt-6-sol (plan)')
  })
})
