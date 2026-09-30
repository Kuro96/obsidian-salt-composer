import type { App } from 'obsidian'

import { parseSmartComposerSettings } from '../../settings/schema/settings'
import { ToolCallResponseStatus } from '../../types/tool-call.types'
import { McpManager, SessionMode } from '../mcp/mcpManager'
import { ApprovalPolicyImpl } from '../policy/ApprovalPolicyImpl'
import { ToolPermissionPolicyImpl } from '../policy/ToolPermissionPolicyImpl'
import { ToolRegistryImpl } from '../tools/ToolRegistryImpl'

import { ToolExecutor } from './ToolExecutor'

jest.mock('obsidian', () => ({
  ...jest.requireActual<typeof import('obsidian')>('obsidian'),
  Platform: { isDesktop: true },
}))

function tools(enabled = true, autoAcceptReview = true) {
  const files = new Map([['note.md', 'Original note']])
  const settings = parseSmartComposerSettings({
    mcp: {
      servers: [],
      builtin: { toolOptions: { vault_write: { enabled, autoAcceptReview } } },
    },
  })
  const app = {
    vault: {
      adapter: {
        exists: async (path: string) => files.has(path),
        read: async (path: string) => files.get(path) ?? '',
        write: async (path: string, content: string) => {
          files.set(path, content)
        },
      },
    },
  } as unknown as App
  const getSettings = () => settings
  const builtin = settings.mcp.builtin
  if (!builtin) throw new Error('Missing builtin settings')
  const registry = new ToolRegistryImpl(getSettings)
  registry.register({
    tool: {
      name: 'vault_write',
      description: 'Write a note',
      inputSchema: { type: 'object' },
    },
    source: 'builtin',
    tier: 'read-write',
    handler: async (args) => {
      files.set(String(args.path), String(args.content))
      return String(args.content)
    },
  })
  registry.register({
    tool: {
      name: 'vault_read',
      description: 'Read a note',
      inputSchema: { type: 'object' },
    },
    source: 'builtin',
    tier: 'read-only',
    handler: async (args) => files.get(String(args.path)) ?? '',
  })
  registry.register({
    tool: {
      name: 'vault_append',
      description: 'Append to a note',
      inputSchema: { type: 'object' },
    },
    source: 'builtin',
    tier: 'read-write',
    handler: async (args) => String(args.content),
  })
  registry.register({
    tool: {
      name: 'server__tool',
      description: 'External tool',
      inputSchema: { type: 'object' },
    },
    source: 'external-mcp',
    tier: null,
    handler: async () => '',
  })
  const policy = new ToolPermissionPolicyImpl(
    registry,
    new ApprovalPolicyImpl(),
    getSettings,
  )
  const manager = new McpManager({
    app,
    settings,
    registerSettingsListener: () => () => undefined,
  })
  const executor = (mode: SessionMode) =>
    new ToolExecutor(registry, policy, manager, app, getSettings, mode)
  return { files, builtin, registry, policy, executor, manager }
}

it('does not write or expose a disabled builtin tool', async () => {
  const { files, registry, executor } = tools(false)
  const response = await executor('read-write').execute({
    name: 'vault_write',
    args: { path: 'note.md', content: 'Changed note' },
    conversationId: 'chat',
  })
  expect(files.get('note.md')).toBe('Original note')
  expect(response.status).toBe(ToolCallResponseStatus.Error)
  expect(registry.list().map((tool) => tool.name)).not.toContain('vault_write')
})

it('uses the builtin pack behavior through the legacy manager entrypoint', async () => {
  const { files, manager } = tools()
  const written = await manager.callTool({
    name: 'vault_write',
    args: { path: 'note.md', content: 'Updated note' },
  })
  expect(written.status).toBe(ToolCallResponseStatus.Success)
  expect(files.get('note.md')).toBe('Updated note')
  const read = await manager.callTool({
    name: 'vault_read',
    args: { path: 'note.md' },
  })
  expect(read).toEqual({
    status: ToolCallResponseStatus.Success,
    data: { type: 'text', text: 'Updated note' },
  })
})

it('does not write in read-only mode even after conversation approval', async () => {
  const { files, policy, executor } = tools()
  policy.allowForConversation('vault_write', 'chat')
  const response = await executor('read-only').execute({
    name: 'vault_write',
    args: { path: 'note.md', content: 'Changed note' },
    conversationId: 'chat',
  })
  expect(files.get('note.md')).toBe('Original note')
  expect(response.status).toBe(ToolCallResponseStatus.Error)
  const read = await executor('read-only').execute({
    name: 'vault_read',
    args: { path: 'note.md' },
    conversationId: 'chat',
  })
  expect(read).toEqual({
    status: ToolCallResponseStatus.Success,
    data: { type: 'text', text: 'Original note' },
  })
})

it('keeps one diff review and prevents applying it when the tool becomes unavailable', async () => {
  const { files, builtin, executor } = tools(true, false)
  const response = await executor('read-write').execute({
    name: 'vault_write',
    args: { path: 'note.md', content: 'Changed note' },
    conversationId: 'chat',
  })
  expect(response.status).toBe(ToolCallResponseStatus.PendingReview)
  if (response.status !== ToolCallResponseStatus.PendingReview)
    throw new Error('Missing review proposal')
  expect(files.get('note.md')).toBe('Original note')
  const readonly = await executor('read-only').applyReview({
    proposal: response.proposal,
    conversationId: 'chat',
  })
  expect(files.get('note.md')).toBe('Original note')
  expect(readonly.status).toBe(ToolCallResponseStatus.Error)
  builtin.toolOptions.vault_write.enabled = false
  const disabled = await executor('read-write').applyReview({
    proposal: response.proposal,
    conversationId: 'chat',
  })
  expect(files.get('note.md')).toBe('Original note')
  expect(disabled.status).toBe(ToolCallResponseStatus.Error)
  builtin.toolOptions.vault_write.enabled = true
  const accepted = await executor('read-write').applyReview({
    proposal: response.proposal,
    conversationId: 'chat',
  })
  expect(accepted.status).toBe(ToolCallResponseStatus.Success)
  expect(files.get('note.md')).toBe('Changed note')
})

it('preserves conversation approval priority and external tools in read-only mode', async () => {
  const { builtin, registry, policy, executor } = tools()
  builtin.policy.readOnlyDefault = 'deny'
  expect(executor('read-only').isAllowed('vault_read', 'chat')).toBe(false)
  policy.allowForConversation('vault_read', 'chat')
  expect(executor('read-only').isAllowed('vault_read', 'chat')).toBe(true)
  expect(
    registry.list({ mode: 'read-only' }).map((tool) => tool.name),
  ).toContain('server__tool')
})

it.each([
  { path: 'note.md', current: 'Edited by user' },
  { path: 'note.md', current: undefined },
  { path: 'new.md', current: 'New user note' },
])(
  'preserves a changed file when accepting a stale review ($path, $current)',
  async ({ path, current }) => {
    const { files, executor } = tools(true, false)
    const response = await executor('read-write').execute({
      name: 'vault_write',
      args: { path, content: 'Proposed note' },
      conversationId: 'chat',
    })
    if (response.status !== ToolCallResponseStatus.PendingReview)
      throw new Error('Missing review proposal')
    if (current === undefined) files.delete(path)
    else files.set(path, current)
    const accepted = await executor('read-write').applyReview({
      proposal: response.proposal,
      conversationId: 'chat',
    })
    expect(files.get(path)).toBe(current)
    expect(accepted.status).toBe(ToolCallResponseStatus.Error)
  },
)

it('still applies an append that inserts a trailing newline', async () => {
  const { files, executor } = tools(true, false)
  const response = await executor('read-write').execute({
    name: 'vault_append',
    args: {
      path: 'note.md',
      content: 'Appended text',
      ensureTrailingNewline: true,
    },
    conversationId: 'chat',
  })
  if (response.status !== ToolCallResponseStatus.PendingReview)
    throw new Error('Missing review proposal')
  const accepted = await executor('read-write').applyReview({
    proposal: response.proposal,
    conversationId: 'chat',
  })
  expect(accepted.status).toBe(ToolCallResponseStatus.Success)
  expect(files.get('note.md')).toBe('Original note\nAppended text')
})

it('cancels a registered tool through the UI manager and ignores its late result', async () => {
  const { files, registry, executor, manager } = tools()
  const entry = registry.resolve('vault_read')
  if (!entry) throw new Error('Missing read tool')
  let finish!: () => void
  const waiting = new Promise<void>((resolve) => {
    finish = resolve
  })
  registry.register({
    ...entry,
    handler: async () => {
      await waiting
      return files.get('note.md') ?? ''
    },
  })
  const pending = executor('read-only').execute({
    name: 'vault_read',
    id: 'call',
    conversationId: 'chat',
  })
  const cancelled = manager.abortToolCall('call')
  finish()
  const response = await pending
  expect(cancelled).toBe(true)
  expect(response.status).toBe(ToolCallResponseStatus.Aborted)
  expect(manager.abortToolCall('call')).toBe(false)
})

it('does not apply a write from an already cancelled request', async () => {
  const { files, executor } = tools()
  const controller = new AbortController()
  controller.abort()
  const response = await executor('read-write').execute({
    name: 'vault_write',
    args: { path: 'note.md', content: 'Changed note' },
    conversationId: 'chat',
    signal: controller.signal,
  })
  expect(response.status).toBe(ToolCallResponseStatus.Aborted)
  expect(files.get('note.md')).toBe('Original note')
})

it('keeps a replacement call cancellable after the older call finishes', async () => {
  const { files, registry, executor, manager } = tools()
  const entry = registry.resolve('vault_read')
  if (!entry) throw new Error('Missing read tool')
  let finishFirst!: () => void
  let finishSecond!: () => void
  const firstRead = new Promise<void>((resolve) => {
    finishFirst = resolve
  })
  const secondRead = new Promise<void>((resolve) => {
    finishSecond = resolve
  })
  files.set('first.md', 'First note')
  files.set('second.md', 'Second note')
  registry.register({
    ...entry,
    handler: async (args) => {
      await (args.path === 'first.md' ? firstRead : secondRead)
      return files.get(String(args.path)) ?? ''
    },
  })
  const first = executor('read-only').execute({
    name: 'vault_read',
    args: { path: 'first.md' },
    id: 'call',
    conversationId: 'chat',
  })
  const second = executor('read-only').execute({
    name: 'vault_read',
    args: { path: 'second.md' },
    id: 'call',
    conversationId: 'chat',
  })
  finishFirst()
  const firstResult = await first
  const cancelled = manager.abortToolCall('call')
  finishSecond()
  const secondResult = await second
  expect(firstResult.status).toBe(ToolCallResponseStatus.Aborted)
  expect(cancelled).toBe(true)
  expect(secondResult.status).toBe(ToolCallResponseStatus.Aborted)
})
