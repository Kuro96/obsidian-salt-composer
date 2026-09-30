import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses'
import type { ReasoningEffort } from 'openai/resources/shared'

import { LLMRequest } from '../../types/llm/request'

import { CodexMessageAdapter } from './codexMessageAdapter'
import {
  buildCodexRequestHeaders,
  resolveCodexModel,
} from './openaiCodexProvider'

describe('OpenAI Codex GPT-6 and GPT-6.1 models', () => {
  it.each(['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6.1-sol'])(
    'should map the %s fast model to priority service tier',
    (model) => {
      expect(resolveCodexModel(`${model}-fast`)).toEqual({
        model,
        serviceTier: 'priority',
      })
    },
  )

  it('should preserve a normal model without a service tier', () => {
    expect(resolveCodexModel('gpt-6.1-sol')).toEqual({ model: 'gpt-6.1-sol' })
  })

  it('should identify itself and request an SSE response', () => {
    expect(buildCodexRequestHeaders('access-token', 'account-id')).toEqual({
      Accept: 'text/event-stream',
      authorization: 'Bearer access-token',
      originator: 'obsidian-salt-composer',
      'ChatGPT-Account-Id': 'account-id',
    })
  })

  it('should pass reasoning and priority service tier to Responses API', () => {
    const adapter = new CodexMessageAdapter()
    const request: LLMRequest = {
      model: 'gpt-6.1-sol',
      messages: [{ role: 'user', content: 'Hello' }],
      reasoning_effort: 'max' as ReasoningEffort,
      reasoning_summary: 'auto',
      service_tier: 'priority',
      stream: true,
    }
    const requestBuilder = adapter as unknown as {
      buildRequestBody(args: {
        request: LLMRequest
        stream: boolean
      }): ResponseCreateParamsBase
    }

    expect(requestBuilder.buildRequestBody({ request, stream: true })).toEqual(
      expect.objectContaining({
        model: 'gpt-6.1-sol',
        reasoning: { effort: 'max', summary: 'auto' },
        service_tier: 'priority',
      }),
    )
  })
})
