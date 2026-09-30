import {
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_PROVIDERS,
} from '../../constants'

import { parseSmartComposerSettings } from './settings'

describe('parseSmartComposerSettings', () => {
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
