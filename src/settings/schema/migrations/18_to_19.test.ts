import { migrateFrom18To19 } from './18_to_19'

describe('Migration from v18 to v19', () => {
  it('should add GPT-5.6 plan models and select Sol for the previous default', () => {
    const result = migrateFrom18To19({
      version: 18,
      chatModelId: 'gpt-5.5 (plan)',
      chatModels: [
        {
          providerType: 'openai-plan',
          providerId: 'openai-plan',
          id: 'gpt-5.5 (plan)',
          model: 'gpt-5.5',
        },
      ],
    })
    const chatModels = result.chatModels as {
      id: string
      model: string
      reasoning?: {
        reasoning_effort?: string
        reasoning_summary?: string
      }
    }[]

    expect(result.version).toBe(19)
    expect(result.chatModelId).toBe('gpt-5.6-sol (plan)')
    expect(chatModels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gpt-5.6-sol (plan)',
          model: 'gpt-5.6-sol',
          reasoning: {
            reasoning_effort: 'low',
            reasoning_summary: 'auto',
          },
        }),
        expect.objectContaining({
          id: 'gpt-5.6-terra-fast (plan)',
          model: 'gpt-5.6-terra-fast',
        }),
        expect.objectContaining({
          id: 'gpt-5.6-luna-fast (plan)',
          model: 'gpt-5.6-luna-fast',
        }),
      ]),
    )
  })
})
