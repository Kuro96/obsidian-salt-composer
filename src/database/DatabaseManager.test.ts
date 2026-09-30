import type { App } from 'obsidian'

import { DatabaseManager } from './DatabaseManager'

jest.mock('./modules/vector/VectorManager', () => ({
  VectorManager: jest.fn(),
}))

it('does not recreate an existing database when reading it fails', async () => {
  const original = new Uint8Array([1, 2, 3]).buffer
  let saved = original
  const app = {
    vault: {
      adapter: {
        exists: async () => true,
        readBinary: async () => {
          throw new Error('Cannot read existing database')
        },
        writeBinary: async (_path: string, value: ArrayBuffer) => {
          saved = value
        },
      },
    },
  } as unknown as App
  await expect(DatabaseManager.create(app)).rejects.toThrow(
    'Cannot read existing database',
  )
  expect(saved).toBe(original)
})

it('reports a failed save and still closes the database during cleanup', async () => {
  const app = {
    vault: {
      adapter: {
        writeBinary: async () => {
          throw new Error('Cannot write database')
        },
      },
    },
  } as unknown as App
  const manager = new DatabaseManager(app, 'database.tar.gz')
  let closed = false
  Object.assign(manager, {
    pgClient: {
      dumpDataDir: async () => new Blob(['database']),
      close: async () => {
        closed = true
      },
    },
  })
  await expect(manager.save()).rejects.toThrow('Cannot write database')
  await expect(manager.cleanup()).rejects.toThrow('Cannot write database')
  expect(closed).toBe(true)
})
