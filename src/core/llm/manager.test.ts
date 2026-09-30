import {
  SmartComposerSettings,
  smartComposerSettingsSchema,
} from '../../settings/schema/setting.types'
import { parseSmartComposerSettings } from '../../settings/schema/settings'
import { getEmbeddingModelClient } from '../rag/embedding'

import * as codexAuth from './codexAuth'
import { CodexMessageAdapter } from './codexMessageAdapter'
import { getChatModelClient } from './manager'

jest.mock('lodash.isequal', () => ({
  __esModule: true,
  default: jest.requireActual('lodash.isequal'),
}))

jest.mock('obsidian', () => ({
  ...jest.requireActual<typeof import('obsidian')>('obsidian'),
  Platform: { isDesktop: true },
}))

afterEach(() => jest.restoreAllMocks())

it('rejects missing selections without replacing the selected models', () => {
  const settings = parseSmartComposerSettings({
    ...parseSmartComposerSettings({}),
    chatModelId: 'deleted-chat',
    embeddingModelId: 'deleted-embedding',
  })
  expect(() =>
    getChatModelClient({
      settings,
      modelId: settings.chatModelId,
      setSettings: () => undefined,
    }),
  ).toThrow()
  expect(() =>
    getEmbeddingModelClient({
      settings,
      embeddingModelId: settings.embeddingModelId,
    }),
  ).toThrow()
  expect(settings.chatModelId).toBe('deleted-chat')
  expect(settings.embeddingModelId).toBe('deleted-embedding')
})

it.each(['chat', 'embedding'])(
  'rejects a %s model whose provider type does not match',
  (kind) => {
    const settings = parseSmartComposerSettings({
      providers: [{ id: 'custom', type: 'ollama' }],
      chatModels: [
        {
          id: 'custom-chat',
          providerId: 'custom',
          providerType: 'openai',
          model: 'custom',
        },
      ],
      embeddingModels: [
        {
          id: 'custom-embedding',
          providerId: 'custom',
          providerType: 'openai',
          model: 'custom',
          dimension: 1536,
        },
      ],
    })
    expect(() =>
      kind === 'chat'
        ? getChatModelClient({
            settings,
            modelId: 'custom-chat',
            setSettings: () => undefined,
          })
        : getEmbeddingModelClient({
            settings,
            embeddingModelId: 'custom-embedding',
          }),
    ).toThrow()
  },
)

it.each(['preferences', 'logout'])(
  'does not overwrite %s changed during OAuth refresh',
  async (change) => {
    let settings = parseSmartComposerSettings({
      providers: [
        {
          id: 'openai-plan',
          type: 'openai-plan',
          oauth: {
            accessToken: 'expired',
            refreshToken: 'old-refresh',
            expiresAt: 0,
          },
        },
      ],
    })
    let resolveRefresh!: (
      tokens: Awaited<ReturnType<typeof codexAuth.refreshCodexAccessToken>>,
    ) => void
    jest.spyOn(codexAuth, 'refreshCodexAccessToken').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )
    jest
      .spyOn(CodexMessageAdapter.prototype, 'generateResponse')
      .mockResolvedValue({
        id: 'response',
        model: 'gpt-6.1-sol',
        object: 'chat.completion',
        choices: [],
      })
    const setSettings = async (
      update:
        | SmartComposerSettings
        | ((current: SmartComposerSettings) => SmartComposerSettings),
    ) => {
      settings = smartComposerSettingsSchema.parse(
        typeof update === 'function' ? update(settings) : update,
      )
    }
    const { providerClient, model } = getChatModelClient({
      settings,
      modelId: settings.chatModelId,
      setSettings,
    })
    const pending = providerClient.generateResponse(model, {
      model: model.model,
      messages: [],
    })
    await setSettings({
      ...settings,
      chatOptions: { ...settings.chatOptions, enableTools: false },
      providers:
        change === 'logout'
          ? settings.providers.map((provider) =>
              provider.type === 'openai-plan'
                ? { ...provider, oauth: undefined }
                : provider,
            )
          : settings.providers,
    })
    resolveRefresh({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      id_token: '',
    })
    await pending
    expect(settings.chatOptions.enableTools).toBe(false)
    const provider = settings.providers.find(
      (item) => item.type === 'openai-plan',
    )
    expect(
      provider?.type === 'openai-plan'
        ? provider.oauth?.accessToken
        : undefined,
    ).toBe(change === 'logout' ? undefined : 'new-access')
  },
)
