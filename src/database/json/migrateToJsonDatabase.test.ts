import type { App } from 'obsidian'

import type { DatabaseManager } from '../DatabaseManager'

import { ChatManager } from './chat/ChatManager'
import { INITIAL_MIGRATION_MARKER, ROOT_DIR } from './constants'
import { migrateToJsonDatabase } from './migrateToJsonDatabase'
import { TemplateManager } from './template/TemplateManager'

jest.mock('fuzzysort', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('fuzzysort')>('fuzzysort'),
}))

jest.mock('path-browserify', () => ({
  __esModule: true,
  default:
    jest.requireActual<typeof import('path-browserify')>('path-browserify'),
}))

function storage() {
  const files = new Map<string, string>()
  const directories = new Set(['.smtcmp_chat_histories'])
  let failedPath: string | undefined
  const app = {
    vault: {
      adapter: {
        exists: async (path: string) =>
          files.has(path) || directories.has(path),
        mkdir: async (path: string) => {
          await Promise.resolve()
          directories.add(path)
        },
        read: async (path: string) => {
          const value = files.get(path)
          if (value === undefined) throw new Error('Missing file')
          return value
        },
        write: async (path: string, value: string) => {
          if (path === failedPath) throw new Error('Write failed')
          const dir = path.substring(0, path.lastIndexOf('/'))
          if (!directories.has(dir)) throw new Error(`Missing directory ${dir}`)
          files.set(path, value)
        },
        list: async (dir: string) => {
          if (!directories.has(dir)) throw new Error(`Missing directory ${dir}`)
          return {
            files: [...files.keys()].filter((path) =>
              path.startsWith(`${dir}/`),
            ),
            folders: [],
          }
        },
        remove: async (path: string) => {
          files.delete(path)
        },
      },
    },
  } as unknown as App
  return {
    app,
    files,
    directories,
    fail: (path?: string) => {
      failedPath = path
    },
  }
}

it('waits for the chat directory before creating or listing the first chat', async () => {
  const { app, files } = storage()
  const manager = new ChatManager(app)
  await manager.createChat({ id: 'first', title: 'First chat' })
  expect(files.has(`${ROOT_DIR}/chats/first.json`)).toBe(true)
  expect((await manager.listChats()).map((chat) => chat.id)).toEqual(['first'])
})

it('retries a failed chat migration without losing old data or duplicating successful chats', async () => {
  const { app, files, directories, fail } = storage()
  directories.add(ROOT_DIR)
  const chats = ['first', 'second'].map((id) => ({
    id,
    title: id,
    schemaVersion: 3,
    createdAt: 1,
    updatedAt: 1,
    messages: [],
  }))
  files.set('.smtcmp_chat_histories/chat_list.json', JSON.stringify(chats))
  for (const chat of chats)
    files.set(`.smtcmp_chat_histories/${chat.id}.json`, JSON.stringify(chat))
  const db = {
    getTemplateManager: () => ({ findAllTemplates: async () => [] }),
  } as unknown as DatabaseManager
  fail(`${ROOT_DIR}/chats/second.json`)
  await expect(migrateToJsonDatabase(app, db)).rejects.toThrow()
  expect(files.has(`${ROOT_DIR}/${INITIAL_MIGRATION_MARKER}`)).toBe(false)
  expect(files.has('.smtcmp_chat_histories/second.json')).toBe(true)
  fail()
  await migrateToJsonDatabase(app, db)
  expect(files.has(`${ROOT_DIR}/${INITIAL_MIGRATION_MARKER}`)).toBe(true)
  expect(
    (await new ChatManager(app).listChats()).map((chat) => chat.id).sort(),
  ).toEqual(['first', 'second'])
})

it('leaves template migration unfinished on failure and retries without losing the legacy template', async () => {
  const { app, files, directories } = storage()
  directories.add(ROOT_DIR)
  let fail = true
  const templates = [
    { id: 'template', name: 'Example', content: 'Original template' },
  ]
  const legacy = {
    findAllTemplates: async () => templates,
    deleteTemplate: async () => {
      if (fail) throw new Error('Legacy delete failed')
      templates.splice(0)
    },
  }
  const db = { getTemplateManager: () => legacy } as unknown as DatabaseManager
  await expect(migrateToJsonDatabase(app, db)).rejects.toThrow()
  expect(files.has(`${ROOT_DIR}/${INITIAL_MIGRATION_MARKER}`)).toBe(false)
  expect(templates).toHaveLength(1)
  expect((await new TemplateManager(app).findByName('Example'))?.content).toBe(
    'Original template',
  )
  fail = false
  await migrateToJsonDatabase(app, db)
  expect(files.has(`${ROOT_DIR}/${INITIAL_MIGRATION_MARKER}`)).toBe(true)
  expect((await new TemplateManager(app).listMetadata()).length).toBe(1)
})
