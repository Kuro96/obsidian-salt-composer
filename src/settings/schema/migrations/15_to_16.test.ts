import { migrateFrom15To16 } from './15_to_16'

describe('Migration from v15 to v16', () => {
  it('should increment version to 16', () => {
    const oldSettings = {
      version: 15,
    }
    const result = migrateFrom15To16(oldSettings)
    expect(result.version).toBe(16)
  })

  it('should keep custom providers while applying default providers', () => {
    const oldSettings = {
      version: 15,
      providers: [
        { type: 'anthropic', id: 'anthropic', apiKey: 'anthropic-key' },
        { type: 'custom', id: 'custom-provider', apiKey: 'custom-key' },
      ],
      chatModels: [],
    }

    const result = migrateFrom15To16(oldSettings)
    const providers = result.providers as { type: string; id: string }[]
    expect(providers.find((p) => p.type === 'openai-plan')).toBeDefined()
    expect(
      providers.find((p) => p.id === 'custom-provider' && p.type === 'custom'),
    ).toBeDefined()
  })

  it('should keep custom models while applying default chat models', () => {
    const oldSettings = {
      version: 15,
      providers: [],
      chatModels: [
        {
          id: 'custom-model',
          providerType: 'custom',
          providerId: 'custom',
          model: 'custom-model',
        },
      ],
    }

    const result = migrateFrom15To16(oldSettings)
    const chatModels = result.chatModels as {
      id: string
      providerType: string
      providerId: string
      model: string
    }[]

    const gptPlan = chatModels.find((m) => m.id === 'gpt-5.2 (plan)')

    expect(gptPlan).toMatchObject({
      providerType: 'openai-plan',
      providerId: 'openai-plan',
      model: 'gpt-5.2',
    })
    expect(chatModels.find((m) => m.id === 'custom-model')).toBeDefined()
  })
})
