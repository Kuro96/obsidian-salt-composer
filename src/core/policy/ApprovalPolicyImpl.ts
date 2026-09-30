/** Conversation approvals; persistent tool options are read from settings. */

import type { ApprovalPolicy } from './types'

export class ApprovalPolicyImpl implements ApprovalPolicy {
  /** conversationId → Set<toolName> */
  private readonly conversationApprovals = new Map<string, Set<string>>()

  isAllowedForConversation(toolName: string, conversationId: string): boolean {
    return (
      this.conversationApprovals.get(conversationId)?.has(toolName) ?? false
    )
  }

  setConversationApproval(toolName: string, conversationId: string): void {
    let set = this.conversationApprovals.get(conversationId)
    if (!set) {
      set = new Set<string>()
      this.conversationApprovals.set(conversationId, set)
    }
    set.add(toolName)
  }

  clearConversationApprovals(conversationId: string): void {
    this.conversationApprovals.delete(conversationId)
  }
}
