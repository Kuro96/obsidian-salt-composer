/** Conversation approval precedes configured automatic execution options.
 * Visibility separately enforces disabled tools and read-only sessions. */

import type { SmartComposerSettings } from '../../settings/schema/setting.types'
import { getBuiltinToolTier } from '../mcp/builtin-tool-tiers'
import { InvalidToolNameException } from '../mcp/exception'
import type { SessionMode } from '../mcp/mcpManager'
import { parseToolName } from '../mcp/tool-name-utils'
import type { ToolRegistry } from '../tools/ToolRegistry'

import type {
  ApprovalDecision,
  ApprovalPolicy,
  ToolPermissionPolicy,
} from './types'

export class ToolPermissionPolicyImpl implements ToolPermissionPolicy {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly approvalPolicy: ApprovalPolicy,
    private readonly getSettings: () => SmartComposerSettings,
  ) {}

  /**
   * 工具是否在当前 session 模式下对模型可见。
   * read-only 模式下，tier 为 read-write 或 danger-zone 的工具不可见。
   */
  isVisible(toolName: string, mode: SessionMode): boolean {
    const tier = this.getTier(toolName)
    const entry = this.registry.resolve(toolName)
    const builtin = entry ? entry.source === 'builtin' : tier !== null
    if (
      builtin &&
      this.getSettings().mcp.builtin?.toolOptions?.[toolName]?.enabled === false
    )
      return false
    if (mode === 'read-write') return true
    // read-only：只允许 read-only tier
    if (tier === 'read-write' || tier === 'danger-zone') return false
    return true
  }

  /**
   * 获取工具调用的审批决策。
   */
  getApprovalDecision(
    toolName: string,
    conversationId?: string,
  ): ApprovalDecision {
    // 1. 会话级批准优先
    if (
      conversationId &&
      this.approvalPolicy.isAllowedForConversation(toolName, conversationId)
    ) {
      return 'allow'
    }

    const tier = this.getTier(toolName)

    // 2. 内置工具按 tier 决策
    if (tier !== null) {
      const builtinOverride = this.getBuiltinToolOverride(toolName)
      if (builtinOverride === 'allow') return 'allow'

      if (tier === 'read-only')
        return this.builtinDefaultPolicy().readOnlyDefault
      if (tier === 'danger-zone')
        return this.builtinDefaultPolicy().dangerousDefault
      return this.builtinDefaultPolicy().readWriteDefault
    }

    // 3. 外部 MCP 工具：查 server.toolOptions.allowAutoExecution
    try {
      const { serverName, toolName: originalName } = parseToolName(toolName)
      const settings = this.getSettings()
      const server = settings.mcp.servers.find((s) => s.id === serverName)
      if (!server) return 'ask'
      const opt = server.toolOptions[originalName]
      if (opt?.allowAutoExecution) return 'allow'
      return 'ask'
    } catch (e) {
      if (e instanceof InvalidToolNameException) return 'ask'
      throw e
    }
  }

  allowForConversation(toolName: string, conversationId: string): void {
    this.approvalPolicy.setConversationApproval(toolName, conversationId)
  }

  // ─── 内部辅助 ──────────────────────────────────────────────────────────────

  private getTier(toolName: string) {
    // 优先从注册表获取（精确），回退到名称匹配
    const entry = this.registry.resolve(toolName)
    if (entry?.tier !== undefined) return entry.tier
    return getBuiltinToolTier(toolName)
  }

  private builtinDefaultPolicy(): {
    readOnlyDefault: ApprovalDecision
    readWriteDefault: ApprovalDecision
    dangerousDefault: ApprovalDecision
  } {
    const settings = this.getSettings()
    const builtinPolicy = settings.mcp.builtin?.policy

    return {
      readOnlyDefault: builtinPolicy?.readOnlyDefault ?? 'allow',
      readWriteDefault:
        builtinPolicy?.readWriteDefault ??
        (settings.chatOptions.defaultAllowBuiltinReadWrite ? 'allow' : 'ask'),
      dangerousDefault: builtinPolicy?.dangerousDefault ?? 'ask',
    }
  }

  private getBuiltinToolOverride(toolName: string): ApprovalDecision | null {
    const settings = this.getSettings()
    const option = settings.mcp.builtin?.toolOptions?.[toolName]

    if (option?.autoExecute === true) return 'allow'
    return null
  }
}
