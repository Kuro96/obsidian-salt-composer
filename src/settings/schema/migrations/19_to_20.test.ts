import { migrateFrom19To20 } from './19_to_20'

describe('migrateFrom19To20', () => {
  const customModel = {
    providerType: 'openai-plan',
    providerId: 'openai-plan',
    id: 'custom-model',
    model: 'gpt-5.6-sol',
  }

  it('replaces retired presets and resets their selection while preserving custom models', () => {
    const migrated = migrateFrom19To20({
      version: 19,
      chatModelId: 'gpt-5.6-sol-fast (plan)',
      chatModels: [
        {
          providerType: 'openai-plan',
          providerId: 'openai-plan',
          id: 'gpt-5.6-sol-fast (plan)',
          model: 'gpt-5.6-sol-fast',
        },
        customModel,
      ],
    })

    expect(migrated.chatModels).toContainEqual(customModel)
    expect(migrated.chatModels).not.toContainEqual(
      expect.objectContaining({ id: 'gpt-5.6-sol-fast (plan)' }),
    )
    expect(migrated.chatModelId).toBe('gpt-6.1-sol (plan)')
    expect(migrated.version).toBe(20)
  })

  it('preserves a selected custom model', () => {
    const migrated = migrateFrom19To20({
      version: 19,
      chatModelId: customModel.id,
      chatModels: [customModel],
    })

    expect(migrated.chatModelId).toBe(customModel.id)
    expect(migrated.chatModels).toContainEqual(customModel)
  })
})
