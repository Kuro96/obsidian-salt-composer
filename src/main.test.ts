import { App, PluginManifest } from 'obsidian'

import { RAGEngine } from './core/rag/ragEngine'
import type { VectorManager } from './database/modules/vector/VectorManager'
import SmartComposerPlugin from './main'
import { SmartComposerSettings } from './settings/schema/setting.types'
import { parseSmartComposerSettings } from './settings/schema/settings'

// ts-jest emits CommonJS without the default-import interop used by esbuild.
jest.mock('lodash.isequal', () => ({
  __esModule: true,
  default: jest.requireActual('lodash.isequal'),
}))

jest.mock('./ApplyView', () => ({}))
jest.mock('./ChatView', () => ({}))
jest.mock('./settings/SettingTab', () => ({}))
jest.mock('./core/mcp/mcpManager', () => ({}))
jest.mock('./database/DatabaseManager', () => ({}))
jest.mock('./database/json/migrateToJsonDatabase', () => ({}))
jest.mock('./components/modals/InstallerUpdateRequiredModal', () => ({}))
jest.mock('./utils/obsidian', () => ({}))
jest.mock('obsidian', () => ({
  ...jest.requireActual<typeof import('obsidian')>('obsidian'),
  Notice: jest.fn(),
  Plugin: class {
    constructor(
      public app: App,
      public manifest: PluginManifest,
    ) {}
  },
}))

function storedPlugin(input: unknown, failBackup = false) {
  const dir = '.obsidian/plugins/test-plugin'
  const dataPath = `${dir}/data.json`
  const files = new Map([[dataPath, JSON.stringify(input)]])
  const app = {
    vault: {
      adapter: {
        write: async (path: string, content: string) => {
          if (failBackup) throw new Error('Backup write failed')
          files.set(path, content)
        },
      },
    },
  } as unknown as App
  const plugin = new SmartComposerPlugin(app, {
    id: 'test-plugin',
    dir,
    name: 'Test plugin',
    version: '0.0.0',
    minAppVersion: '0.0.0',
    description: '',
    author: 'maintainer',
  })
  plugin.loadData = async () =>
    JSON.parse(files.get(dataPath) ?? 'null') as unknown
  plugin.saveData = async (settings: SmartComposerSettings) => {
    files.set(dataPath, JSON.stringify(settings))
  }
  return { plugin, files, dataPath }
}

it('backs up all original data before saving normalized settings', async () => {
  const input = {
    providers: [
      { id: 'custom', type: 'openai', apiKey: 'test-key' },
      { id: 'unknown', type: 'unsupported', apiKey: 'unknown-key' },
    ],
    unknownField: { preserve: true },
  }
  const { plugin, files, dataPath } = storedPlugin(input)
  await plugin.loadSettings()
  const backups = [...files].filter(([path]) => path !== dataPath)
  expect(backups).toHaveLength(1)
  expect(JSON.parse(backups[0]?.[1] ?? 'null')).toEqual(input)
  expect(JSON.parse(files.get(dataPath) ?? 'null').providers).toContainEqual(
    input.providers[0],
  )
  expect(
    parseSmartComposerSettings(JSON.parse(files.get(dataPath) ?? 'null')),
  ).toEqual(plugin.settings)
  await plugin.loadSettings()
  expect([...files].filter(([path]) => path !== dataPath)).toHaveLength(1)
})

it('keeps original data and refuses setting writes if the backup fails', async () => {
  const input = { ...parseSmartComposerSettings({}), unknownField: 'preserve' }
  const { plugin, files, dataPath } = storedPlugin(input, true)
  await plugin.loadSettings()
  expect(JSON.parse(files.get(dataPath) ?? 'null')).toEqual(input)
  await expect(
    plugin.setSettings({ ...plugin.settings, vaultChatEnabled: false }),
  ).rejects.toThrow()
  expect(JSON.parse(files.get(dataPath) ?? 'null')).toEqual(input)
})

it('uses validated settings for runtime, listeners and storage', async () => {
  const { plugin, files, dataPath } = storedPlugin(
    parseSmartComposerSettings({}),
  )
  await plugin.loadSettings()
  let received: SmartComposerSettings | undefined
  plugin.addSettingsChangeListener((settings) => {
    received = settings
  })
  await plugin.setSettings({ ...plugin.settings, vaultChatEnabled: false })
  await plugin.setSettings((current) => ({
    ...current,
    ragOptions: { ...current.ragOptions, chunkSize: NaN },
  }))
  expect(plugin.settings.ragOptions.chunkSize).toBe(1000)
  expect(received?.ragOptions.chunkSize).toBe(1000)
  expect(JSON.parse(files.get(dataPath) ?? 'null').vaultChatEnabled).toBe(false)
  expect(JSON.parse(files.get(dataPath) ?? 'null').ragOptions.chunkSize).toBe(
    1000,
  )
})

it('saves invalid embedding references without leaving the old index client usable', async () => {
  const { plugin, files, dataPath } = storedPlugin(
    parseSmartComposerSettings({ embeddingModelId: 'ollama/nomic-embed-text' }),
  )
  await plugin.loadSettings()
  const vectorManager = {
    updateVaultIndex: async () => undefined,
  } as unknown as VectorManager
  const previousEngine = new RAGEngine(
    plugin.app,
    plugin.settings,
    vectorManager,
  )
  plugin.ragEngine = previousEngine
  await plugin.setSettings({
    ...plugin.settings,
    embeddingModelId: 'deleted-embedding',
  })
  expect(JSON.parse(files.get(dataPath) ?? 'null').embeddingModelId).toBe(
    'deleted-embedding',
  )
  await expect(previousEngine.updateVaultIndex()).rejects.toThrow()
})
