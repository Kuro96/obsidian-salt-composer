/** Tool visibility, automatic execution options and conversation approvals. */

import type { SessionMode } from '../mcp/mcpManager'

// ─── Approval Decision ───────────────────────────────────────────────────────

/**
 * 审批决策三档：
 * - 'allow'：直接自动执行，无需用户介入
 * - 'ask'：暂停，等待用户批准
 * - 'deny'：不自动执行，显式用户批准沿用现有优先级
 */
export type ApprovalDecision = 'allow' | 'ask' | 'deny'

// ─── ToolPermissionPolicy ────────────────────────────────────────────────────

/**
 * ToolPermissionPolicy — 决定工具的可见性与执行权限。
 *
 * 职责分工：
 * - isVisible：决定工具是否出现在发给 LLM 的工具列表中（read-only 模式下写工具不可见）
 * - getApprovalDecision：决定工具调用是自动执行、等待批准还是拒绝
 * - allowForConversation：记录会话批准；永久选项由设置入口保存
 *
 * 该接口整合了当前 McpManager.isToolExecutionAllowed() 和 allowToolForConversation() 的职责。
 */
export type ToolPermissionPolicy = {
  /**
   * 工具是否在当前 session 模式下可见（即是否应出现在 LLM 的工具列表中）。
   * read-only 模式下，tier 为 read-write 或 danger-zone 的工具不可见。
   */
  isVisible(toolName: string, mode: SessionMode): boolean

  /**
   * 获取工具调用的审批决策。
   * 优先级：会话级覆盖 > 永久覆盖 > toolOptions 配置 > policy 默认值。
   */
  getApprovalDecision(
    toolName: string,
    conversationId?: string,
  ): ApprovalDecision

  /**
   * 记录用户为本次会话批准了某工具的自动执行。
   * 对应 UI 中"Allow for this chat"操作。
   */
  allowForConversation(toolName: string, conversationId: string): void
}

// ─── ApprovalPolicy ──────────────────────────────────────────────────────────

/**
 * ApprovalPolicy — 审批规则的存储与查询。
 *
 * 与 ToolPermissionPolicy 的分工：
 * - ToolPermissionPolicy：消费 ApprovalPolicy 的数据，结合 mode + tier 做最终决策
 * - ApprovalPolicy：纯粹的规则存储（会话级 + 全局级），不做策略合并
 *
 * 对应当前 McpManager.allowToolForConversation() 和 settings.toolOptions.allowAutoExecution。
 */
export type ApprovalPolicy = {
  /**
   * 某工具在指定会话中是否已被用户批准自动执行。
   */
  isAllowedForConversation(toolName: string, conversationId: string): boolean

  /**
   * 记录会话级批准。
   */
  setConversationApproval(toolName: string, conversationId: string): void

  /**
   * 清除某个会话的所有批准记录（会话结束时调用）。
   */
  clearConversationApprovals(conversationId: string): void
}
