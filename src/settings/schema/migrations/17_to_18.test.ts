import { migrateFrom17To18 } from './17_to_18'

describe('Migration from v17 to v18', () => {
  it('should keep plan models, remove retired API defaults, and preserve custom models', () => {
    const oldSettings = {
      version: 17,
      chatModelId: 'claude-sonnet-4.5',
      applyModelId: 'gpt-4.1-mini',
      chatModels: [
        {
          id: 'claude-sonnet-4.5',
          providerType: 'anthropic',
          providerId: 'anthropic',
          model: 'claude-sonnet-4-5',
        },
        {
          id: 'gpt-5.2',
          providerType: 'openai',
          providerId: 'openai',
          model: 'gpt-5.2',
        },
        {
          id: 'custom-model',
          providerType: 'openai-compatible',
          providerId: 'custom',
          model: 'custom-model',
        },
      ],
    }

    const result = migrateFrom17To18(oldSettings)
    const chatModels = result.chatModels as { id: string; model: string }[]

    expect(result.version).toBe(18)
    expect(result.applyModelId).toBeUndefined()
    expect(result.chatModelId).toBe('gpt-5.5 (plan)')
    expect(chatModels).toContainEqual(
      expect.objectContaining({
        id: 'gpt-5.5 (plan)',
        model: 'gpt-5.5',
      }),
    )
    expect(chatModels.find((m) => m.id === 'claude-sonnet-4.5')).toBeUndefined()
    expect(chatModels.find((m) => m.id === 'gpt-5.2')).toBeUndefined()
    expect(chatModels.find((m) => m.id === 'custom-model')).toBeDefined()
  })
})
