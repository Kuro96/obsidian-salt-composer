import { Reasoning, ReasoningEffort } from 'openai/resources/shared'

import { ChatModel } from '../../types/chat-model.types'
import {
  LLMOptions,
  LLMRequestNonStreaming,
  LLMRequestStreaming,
} from '../../types/llm/request'
import {
  LLMResponseNonStreaming,
  LLMResponseStreaming,
} from '../../types/llm/response'
import { LLMProvider } from '../../types/provider.types'

import { BaseLLMProvider } from './base'
import { extractCodexAccountId, refreshCodexAccessToken } from './codexAuth'
import { CodexMessageAdapter } from './codexMessageAdapter'
import {
  LLMAPIKeyInvalidException,
  LLMAPIKeyNotSetException,
} from './exception'
import {
  getBrowserCompatibleFetchFn,
  shouldUseObsidianRequestUrlNetworkStack,
} from './transportPolicy'

const CODEX_FAST_MODEL_PATTERN = /^(gpt-6(?:\.1)?-(?:sol|terra|luna))-fast$/

export function resolveCodexModel(model: string): {
  model: string
  serviceTier?: 'priority'
} {
  const fastModelMatch = CODEX_FAST_MODEL_PATTERN.exec(model)
  return fastModelMatch
    ? { model: fastModelMatch[1], serviceTier: 'priority' }
    : { model }
}

export function buildCodexRequestHeaders(
  accessToken: string,
  accountId?: string,
): Record<string, string> {
  return {
    Accept: 'text/event-stream',
    authorization: `Bearer ${accessToken}`,
    originator: 'obsidian-salt-composer',
    ...(accountId ? { 'ChatGPT-Account-Id': accountId } : {}),
  }
}

export class OpenAICodexProvider extends BaseLLMProvider<
  Extract<LLMProvider, { type: 'openai-plan' }>
> {
  private adapter: CodexMessageAdapter
  private onProviderUpdate?: (
    providerId: string,
    update: Partial<LLMProvider>,
  ) => void | Promise<void>

  constructor(
    provider: Extract<LLMProvider, { type: 'openai-plan' }>,
    onProviderUpdate?: (
      providerId: string,
      update: Partial<LLMProvider>,
    ) => void | Promise<void>,
  ) {
    super(provider)
    this.adapter = new CodexMessageAdapter({
      fetchFn: getBrowserCompatibleFetchFn(),
      useObsidianRequestUrl: shouldUseObsidianRequestUrlNetworkStack(),
    })
    this.onProviderUpdate = onProviderUpdate
  }

  async generateResponse(
    model: ChatModel,
    request: LLMRequestNonStreaming,
    options?: LLMOptions,
  ): Promise<LLMResponseNonStreaming> {
    if (model.providerType !== 'openai-plan') {
      throw new Error('Model is not an OpenAI Codex model')
    }

    const authHeaders = await this.getAuthHeaders()
    const normalizedRequest = this.normalizeRequest(model, request)
    return this.adapter.generateResponse(
      normalizedRequest,
      options,
      authHeaders,
    )
  }

  async streamResponse(
    model: ChatModel,
    request: LLMRequestStreaming,
    options?: LLMOptions,
  ): Promise<AsyncIterable<LLMResponseStreaming>> {
    if (model.providerType !== 'openai-plan') {
      throw new Error('Model is not an OpenAI Codex model')
    }

    const authHeaders = await this.getAuthHeaders()
    const normalizedRequest = this.normalizeRequest(model, request)
    return this.adapter.streamResponse(normalizedRequest, options, authHeaders)
  }

  async getEmbedding(
    _model: string,
    _text: string,
    _options?: { dimensions?: number },
  ): Promise<number[]> {
    throw new Error(
      `Provider ${this.provider.id} does not support embeddings. Please use a different provider.`,
    )
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.provider.oauth?.refreshToken) {
      throw new LLMAPIKeyNotSetException(
        `Provider ${this.provider.id} OAuth credentials are missing. Please log in.`,
      )
    }

    if (
      !this.provider.oauth.accessToken ||
      this.provider.oauth.expiresAt <= Date.now()
    ) {
      try {
        const tokens = await refreshCodexAccessToken(
          this.provider.oauth.refreshToken,
        )
        const accountId = extractCodexAccountId(tokens)
        const updatedOauth = {
          accessToken: tokens.access_token,
          refreshToken:
            tokens.refresh_token ?? this.provider.oauth.refreshToken,
          expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
          accountId: accountId ?? this.provider.oauth.accountId,
        }
        this.provider.oauth = updatedOauth
        await this.onProviderUpdate?.(this.provider.id, {
          oauth: updatedOauth,
        })
      } catch (error) {
        throw new LLMAPIKeyInvalidException(
          'OpenAI Codex OAuth token refresh failed. Please log in again.',
          error instanceof Error ? error : undefined,
        )
      }
    }

    return buildCodexRequestHeaders(
      this.provider.oauth.accessToken,
      this.provider.oauth.accountId,
    )
  }

  private normalizeRequest<
    T extends LLMRequestNonStreaming | LLMRequestStreaming,
  >(model: Extract<ChatModel, { providerType: 'openai-plan' }>, request: T): T {
    const reasoningEffort = model.reasoning?.reasoning_effort
    const reasoningSummary = model.reasoning?.reasoning_summary
    const resolvedModel = resolveCodexModel(model.model)
    return {
      ...request,
      model: resolvedModel.model,
      service_tier: resolvedModel.serviceTier,
      reasoning_effort: reasoningEffort
        ? (reasoningEffort as ReasoningEffort)
        : undefined,
      reasoning_summary: reasoningSummary
        ? (reasoningSummary as Reasoning['summary'])
        : undefined,
    }
  }
}
