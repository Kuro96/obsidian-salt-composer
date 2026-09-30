import {
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_PROVIDERS,
} from '../../constants'

import { parseSmartComposerSettings } from './settings'

describe('parseSmartComposerSettings', () => {
  it('keeps valid credentials and models when neighboring entries are invalid', () => {
    const provider = { id: 'custom', type: 'openai', apiKey: 'test-key' }
    const chatModel = {
      id: 'custom-chat',
      providerId: 'custom',
      providerType: 'openai',
      model: 'custom-model',
      reasoning: { enabled: true, reasoning_effort: 'high' },
    }
    const embeddingModel = {
      id: 'custom-embedding',
      providerId: 'custom',
      providerType: 'openai',
      model: 'custom-embedding',
      dimension: 1536,
    }
    const result = parseSmartComposerSettings({
      providers: [
        provider,
        { id: 'openai-plan', type: 'openai-plan', oauth: { broken: true } },
      ],
      chatModels: [chatModel, { ...chatModel, id: 'bad-chat', model: null }],
      embeddingModels: [
        embeddingModel,
        { ...embeddingModel, id: 'bad-embedding', dimension: 'invalid' },
      ],
      chatModelId: chatModel.id,
      embeddingModelId: embeddingModel.id,
    })
    expect(result.providers).toContainEqual(provider)
    expect(result.chatModels).toContainEqual(chatModel)
    expect(result.embeddingModels).toContainEqual(embeddingModel)
    expect(result.chatModelId).toBe(chatModel.id)
    expect(result.embeddingModelId).toBe(embeddingModel.id)
    expect(
      parseSmartComposerSettings(JSON.parse(JSON.stringify(result))),
    ).toEqual(result)
  })

  it('preserves invalid selections so operation boundaries can report them', () => {
    const result = parseSmartComposerSettings({
      ...parseSmartComposerSettings({}),
      chatModelId: 'deleted-chat',
      embeddingModelId: 'deleted-embedding',
    })
    expect(result.chatModelId).toBe('deleted-chat')
    expect(result.embeddingModelId).toBe('deleted-embedding')
  })

  it('should return default values for empty input', () => {
    const result = parseSmartComposerSettings({})
    expect(result).toEqual({
      vaultChatEnabled: true,

      providers: [...DEFAULT_PROVIDERS],

      chatModels: [...DEFAULT_CHAT_MODELS],
      embeddingModels: [...DEFAULT_EMBEDDING_MODELS],

      chatModelId: DEFAULT_CHAT_MODEL_ID,
      embeddingModelId: 'openai/text-embedding-3-small',

      agents: {
        directoryName: '.agents',
      },

      ragOptions: {
        chunkSize: 1000,
        thresholdTokens: 8192,
        minSimilarity: 0.0,
        limit: 10,
        excludePatterns: [],
        includePatterns: [],
      },

      mcp: {
        servers: [],
      },

      skills: {
        paths: [],
        urls: [],
        options: {},
      },

      chatOptions: {
        includeCurrentFileContent: true,
        enableTools: true,
        enableSkills: true,
        maxAutoIterations: 1,
        defaultAllowBuiltinReadWrite: false,
      },
    })
  })

  it('should discard obsolete fields without storing a settings version', () => {
    const result = parseSmartComposerSettings({
      version: 22,
      systemPrompt: 'test prompt',
    })

    expect(result).not.toHaveProperty('version')
    expect(result.vaultChatEnabled).toBe(true)
    expect(result.agents.directoryName).toBe('.agents')
    expect(result).not.toHaveProperty('systemPrompt')
  })
})
