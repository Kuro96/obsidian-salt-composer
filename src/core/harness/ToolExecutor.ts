/** Executes registered tools, stages file reviews and shares cancellation with McpManager. */

import { App, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian'

import { SmartComposerSettings } from '../../settings/schema/setting.types'
import {
  ProposedToolReview,
  ToolCallResponse,
  ToolCallResponseStatus,
} from '../../types/tool-call.types'
import { McpManager, SessionMode } from '../mcp/mcpManager'
import type { ToolPermissionPolicy } from '../policy/types'
import type { ToolRegistry } from '../tools/ToolRegistry'
import {
  ensureParentDirectory,
  getVaultAdapter,
  normalizeVaultPath,
} from '../tools/vaultUtils'

const STAGED_REVIEW_TOOLS = new Set([
  'vault_write',
  'vault_edit',
  'vault_append',
  'note_frontmatter_set',
  'note_frontmatter_delete',
  'vault_move',
  'vault_delete',
])

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissionPolicy: ToolPermissionPolicy,
    private readonly mcpManager: McpManager,
    private readonly app: App,
    private readonly getSettings?: () => SmartComposerSettings,
    private readonly sessionMode: SessionMode = 'read-write',
  ) {}

  isAllowed(toolName: string, conversationId: string): boolean {
    if (!this.isVisible(toolName)) return false
    // Staged review tools skip PendingApproval — the ApplyView diff UI
    // serves as the approval mechanism.
    if (this.shouldStageReview(toolName)) return true
    return (
      this.permissionPolicy.getApprovalDecision(toolName, conversationId) ===
      'allow'
    )
  }

  isVisible(toolName: string): boolean {
    return this.permissionPolicy.isVisible(toolName, this.sessionMode)
  }

  shouldStageReview(toolName: string): boolean {
    return STAGED_REVIEW_TOOLS.has(toolName)
  }

  private isAutoAcceptReview(toolName: string): boolean {
    if (!this.getSettings) return false
    const settings = this.getSettings()
    const option = (
      settings.mcp as {
        builtin?: {
          toolOptions?: Record<string, { autoAcceptReview?: boolean }>
        }
      }
    ).builtin?.toolOptions?.[toolName]
    return option?.autoAcceptReview === true
  }

  async execute(opts: {
    name: string
    args?: string | Record<string, unknown>
    id?: string
    conversationId: string
    signal?: AbortSignal
  }): Promise<ToolCallResponse> {
    const { name, args, id, signal, conversationId } = opts

    if (!this.isVisible(name)) {
      return {
        status: ToolCallResponseStatus.Error,
        error: `Tool ${name} is disabled or unavailable in this session mode.`,
      }
    }

    const parsedArgs: Record<string, unknown> =
      typeof args === 'string'
        ? args === ''
          ? {}
          : (() => {
              try {
                const parsed: unknown = JSON.parse(args)
                return parsed && typeof parsed === 'object'
                  ? (parsed as Record<string, unknown>)
                  : {}
              } catch {
                return {}
              }
            })()
        : (args ?? {})

    const entry = this.registry.resolve(name)
    if (entry) {
      const abortController = this.mcpManager.createToolAbortController(id)
      const onAbort = () => abortController.abort()
      if (signal?.aborted) onAbort()
      else signal?.addEventListener('abort', onAbort, { once: true })

      try {
        if (abortController.signal.aborted)
          return { status: ToolCallResponseStatus.Aborted }
        if (this.shouldStageReview(name)) {
          const proposal = await this.buildReviewProposal(name, parsedArgs)
          if (abortController.signal.aborted)
            return { status: ToolCallResponseStatus.Aborted }

          if (this.isAutoAcceptReview(name)) {
            const response = await this.applyReview({
              proposal,
              conversationId,
            })
            if (abortController.signal.aborted)
              return { status: ToolCallResponseStatus.Aborted }
            if (response.status === ToolCallResponseStatus.Success) {
              return {
                status: ToolCallResponseStatus.Success,
                data: { ...response.data, proposal },
              }
            }
            return response
          }

          return {
            status: ToolCallResponseStatus.PendingReview,
            proposal,
          }
        }
        const text = await entry.handler(parsedArgs, {
          conversationId,
          signal: abortController.signal,
        })
        if (abortController.signal.aborted)
          return { status: ToolCallResponseStatus.Aborted }
        return {
          status: ToolCallResponseStatus.Success,
          data: { type: 'text', text },
        }
      } catch (error) {
        if (
          abortController.signal.aborted ||
          (error as Error).name === 'AbortError'
        ) {
          return { status: ToolCallResponseStatus.Aborted }
        }
        return {
          status: ToolCallResponseStatus.Error,
          error: (error as Error).message || 'Unknown error occurred',
        }
      } finally {
        signal?.removeEventListener('abort', onAbort)
        this.mcpManager.releaseToolAbortController(id, abortController)
      }
    }

    return this.mcpManager.callTool({ name, args, id, signal })
  }

  async applyReview(opts: {
    proposal: ProposedToolReview
    conversationId: string
  }): Promise<ToolCallResponse> {
    const { proposal } = opts

    if (!this.isVisible(proposal.toolName)) {
      return {
        status: ToolCallResponseStatus.Error,
        error: `Tool ${proposal.toolName} is disabled or unavailable in this session mode.`,
      }
    }

    try {
      switch (proposal.kind) {
        case 'write':
        case 'edit':
        case 'append':
        case 'frontmatter': {
          const afterText = proposal.afterText
          if (typeof afterText !== 'string') {
            throw new Error(`Missing reviewed content for ${proposal.toolName}`)
          }
          const adapter = getVaultAdapter(this.app)
          const exists = await adapter.exists?.(proposal.targetPath)
          const currentText = exists
            ? await adapter.read(proposal.targetPath)
            : undefined
          if (currentText !== proposal.beforeText) {
            throw new Error(
              `File changed since review: ${proposal.targetPath}. Generate a new proposal.`,
            )
          }
          const createDirectories =
            proposal.metadata?.createDirectories === true
          if (createDirectories) {
            await ensureParentDirectory(proposal.targetPath, adapter)
          }
          await adapter.write(proposal.targetPath, afterText)
          return {
            status: ToolCallResponseStatus.Success,
            data: { type: 'text', text: proposal.summary },
          }
        }
        case 'move': {
          const rawNewPath = proposal.metadata?.newPath
          if (typeof rawNewPath !== 'string') {
            throw new Error('Missing destination path for reviewed move')
          }
          const target = this.app.vault.getAbstractFileByPath(
            proposal.targetPath,
          )
          if (!target) {
            throw new Error(
              `vault_move: path not found: ${proposal.targetPath}`,
            )
          }
          await this.app.fileManager.renameFile(
            target,
            normalizeVaultPath(rawNewPath),
          )
          return {
            status: ToolCallResponseStatus.Success,
            data: { type: 'text', text: proposal.summary },
          }
        }
        case 'delete': {
          const target = this.app.vault.getAbstractFileByPath(
            proposal.targetPath,
          )
          if (!target) {
            throw new Error(
              `vault_delete: path not found: ${proposal.targetPath}`,
            )
          }
          await this.app.vault.trash(target, true)
          return {
            status: ToolCallResponseStatus.Success,
            data: { type: 'text', text: proposal.summary },
          }
        }
      }
    } catch (error) {
      return {
        status: ToolCallResponseStatus.Error,
        error: (error as Error).message || 'Unknown error occurred',
      }
    }
  }

  abort(id: string): boolean {
    return this.mcpManager.abortToolCall(id)
  }

  private async buildReviewProposal(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    switch (toolName) {
      case 'vault_write':
        return this.buildVaultWriteProposal(args)
      case 'vault_edit':
        return this.buildVaultEditProposal(args)
      case 'vault_append':
        return this.buildVaultAppendProposal(args)
      case 'note_frontmatter_set':
        return this.buildFrontmatterSetProposal(args)
      case 'note_frontmatter_delete':
        return this.buildFrontmatterDeleteProposal(args)
      case 'vault_move':
        return this.buildVaultMoveProposal(args)
      case 'vault_delete':
        return this.buildVaultDeleteProposal(args)
      default:
        throw new Error(`Unsupported reviewed tool: ${toolName}`)
    }
  }

  private async buildVaultWriteProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    const content = args.content
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
      throw new Error('vault_write requires a non-empty "path"')
    }
    if (typeof content !== 'string') {
      throw new Error('vault_write requires a string "content"')
    }

    const targetPath = normalizeVaultPath(rawPath)
    const adapter = getVaultAdapter(this.app)
    const exists = adapter.exists ? await adapter.exists(targetPath) : false
    const beforeText = exists ? await adapter.read(targetPath) : undefined

    return {
      toolName: 'vault_write',
      targetPath,
      kind: 'write',
      beforeText,
      afterText: content,
      summary: exists ? `Overwrite ${targetPath}` : `Create ${targetPath}`,
      metadata: {
        createDirectories:
          typeof args.createDirectories === 'boolean'
            ? args.createDirectories
            : true,
      },
    }
  }

  private async buildVaultEditProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    const oldText = args.oldText
    const newText = args.newText
    const replaceAll = args.replaceAll === true
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('vault_edit requires a non-empty "path"')
    if (typeof oldText !== 'string' || oldText.length === 0)
      throw new Error('vault_edit requires a non-empty string "oldText"')
    if (typeof newText !== 'string')
      throw new Error('vault_edit requires a string "newText"')

    const targetPath = normalizeVaultPath(rawPath)
    const adapter = getVaultAdapter(this.app)
    const beforeText = await adapter.read(targetPath)
    const occurrences = beforeText.split(oldText).length - 1
    if (occurrences === 0)
      throw new Error(`vault_edit could not find oldText in ${targetPath}`)
    if (!replaceAll && occurrences !== 1) {
      throw new Error(
        `vault_edit found ${occurrences} matches; set replaceAll=true or provide a more specific oldText`,
      )
    }

    return {
      toolName: 'vault_edit',
      targetPath,
      kind: 'edit',
      beforeText,
      afterText: replaceAll
        ? beforeText.split(oldText).join(newText)
        : beforeText.replace(oldText, newText),
      summary: `Edit ${targetPath}`,
    }
  }

  private async buildVaultAppendProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    const content = args.content
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('vault_append requires a non-empty "path"')
    if (typeof content !== 'string')
      throw new Error('vault_append requires a string "content"')

    const targetPath = normalizeVaultPath(rawPath)
    const adapter = getVaultAdapter(this.app)
    const exists = adapter.exists ? await adapter.exists(targetPath) : false
    const ensureTrailingNewline = args.ensureTrailingNewline === true
    const beforeText = exists ? await adapter.read(targetPath) : ''
    const separator =
      ensureTrailingNewline &&
      beforeText.length > 0 &&
      !beforeText.endsWith('\n')
        ? '\n'
        : ''

    return {
      toolName: 'vault_append',
      targetPath,
      kind: 'append',
      beforeText: exists ? beforeText : undefined,
      afterText: `${beforeText}${separator}${content}`,
      summary: exists
        ? `Append to ${targetPath}`
        : `Create and append to ${targetPath}`,
      metadata: {
        createDirectories:
          typeof args.createDirectories === 'boolean'
            ? args.createDirectories
            : true,
      },
    }
  }

  private async buildFrontmatterSetProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('note_frontmatter_set requires a non-empty "path"')

    const targetPath = normalizeVaultPath(rawPath)
    const file = this.app.vault.getFileByPath(targetPath)
    if (!file)
      throw new Error(`note_frontmatter_set: file not found: ${targetPath}`)

    const beforeText = await this.app.vault.read(file)
    const updates = args.updates as Record<string, unknown> | undefined
    const removeKeys = Array.isArray(args.removeKeys)
      ? (args.removeKeys as string[])
      : []
    const mergeArrays = args.mergeArrays === true

    return {
      toolName: 'note_frontmatter_set',
      targetPath,
      kind: 'frontmatter',
      beforeText,
      afterText: this.updateFrontmatterText(beforeText, (frontmatter) => {
        if (updates) {
          for (const [key, value] of Object.entries(updates)) {
            if (
              mergeArrays &&
              Array.isArray(frontmatter[key]) &&
              Array.isArray(value)
            ) {
              frontmatter[key] = [
                ...new Set([
                  ...(frontmatter[key] as unknown[]),
                  ...(value as unknown[]),
                ]),
              ]
            } else {
              frontmatter[key] = value
            }
          }
        }
        for (const key of removeKeys) {
          Reflect.deleteProperty(frontmatter, key)
        }
      }),
      summary: `Update frontmatter in ${targetPath}`,
    }
  }

  private async buildFrontmatterDeleteProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    const keys = Array.isArray(args.keys) ? (args.keys as string[]) : []
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('note_frontmatter_delete requires a non-empty "path"')
    if (keys.length === 0)
      throw new Error(
        'note_frontmatter_delete requires a non-empty "keys" array',
      )

    const targetPath = normalizeVaultPath(rawPath)
    const file = this.app.vault.getFileByPath(targetPath)
    if (!file)
      throw new Error(`note_frontmatter_delete: file not found: ${targetPath}`)

    const beforeText = await this.app.vault.read(file)
    return {
      toolName: 'note_frontmatter_delete',
      targetPath,
      kind: 'frontmatter',
      beforeText,
      afterText: this.updateFrontmatterText(beforeText, (frontmatter) => {
        for (const key of keys) {
          Reflect.deleteProperty(frontmatter, key)
        }
      }),
      summary: `Delete frontmatter keys from ${targetPath}`,
    }
  }

  private async buildVaultMoveProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    const rawNewPath = args.newPath
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('vault_move requires a non-empty "path"')
    if (typeof rawNewPath !== 'string' || rawNewPath.trim().length === 0)
      throw new Error('vault_move requires a non-empty "newPath"')

    const targetPath = normalizeVaultPath(rawPath)
    const newPath = normalizeVaultPath(rawNewPath)

    return {
      toolName: 'vault_move',
      targetPath,
      kind: 'move',
      summary: `Move ${targetPath} -> ${newPath}`,
      metadata: { newPath },
    }
  }

  private async buildVaultDeleteProposal(
    args: Record<string, unknown>,
  ): Promise<ProposedToolReview> {
    const rawPath = args.path
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0)
      throw new Error('vault_delete requires a non-empty "path"')

    const targetPath = normalizeVaultPath(rawPath)
    const target = this.app.vault.getAbstractFileByPath(targetPath)
    if (!target) throw new Error(`vault_delete: path not found: ${targetPath}`)

    let beforeText: string | undefined
    if (target instanceof TFile) {
      beforeText = await this.app.vault.read(target)
    }

    return {
      toolName: 'vault_delete',
      targetPath,
      kind: 'delete',
      beforeText,
      summary:
        target instanceof TFolder
          ? `Delete folder ${targetPath}`
          : `Delete file ${targetPath}`,
    }
  }

  private updateFrontmatterText(
    markdown: string,
    mutator: (frontmatter: Record<string, unknown>) => void,
  ): string {
    const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/)
    const rawFrontmatter = match?.[1] ?? ''
    const body = match ? markdown.slice(match[0].length) : markdown
    const parsed =
      rawFrontmatter.trim().length > 0
        ? ((parseYaml(rawFrontmatter) as Record<string, unknown> | null) ?? {})
        : {}

    mutator(parsed)

    const nextKeys = Object.keys(parsed)
    if (nextKeys.length === 0) {
      return body
    }

    const serialized = stringifyYaml(parsed).trimEnd()
    if (body.length === 0) {
      return `---\n${serialized}\n---\n`
    }

    return `---\n${serialized}\n---\n${body.replace(/^\n+/, '')}`
  }
}
