import isEqual from 'lodash.isequal'

import {
  SettingsUpdate,
  SmartComposerSettings,
} from '../../settings/schema/setting.types'
import { ChatModel } from '../../types/chat-model.types'
import { LLMProvider } from '../../types/provider.types'

import { AnthropicProvider } from './anthropic'
import { AzureOpenAIProvider } from './azureOpenaiProvider'
import { BaseLLMProvider } from './base'
import { DeepSeekStudioProvider } from './deepseekStudioProvider'
import { LLMModelNotFoundException } from './exception'
import { GeminiProvider } from './gemini'
import { LmStudioProvider } from './lmStudioProvider'
import { MistralProvider } from './mistralProvider'
import { OllamaProvider } from './ollama'
import { OpenAIAuthenticatedProvider } from './openai'
import { OpenAICodexProvider } from './openaiCodexProvider'
import { OpenAICompatibleProvider } from './openaiCompatibleProvider'
import { OpenRouterProvider } from './openRouterProvider'
import { PerplexityProvider } from './perplexityProvider'
import { XaiProvider } from './xaiProvider'

/*
 * OpenAI, OpenAI-compatible, and Anthropic providers include token usage statistics
 * in the final chunk of the stream (following OpenAI's behavior).
 */

export function getProviderClient({
  providerId,
  expectedProviderType,
  settings,
  setSettings,
}: {
  providerId: string
  expectedProviderType?: LLMProvider['type']
  settings: SmartComposerSettings
  setSettings?: (newSettings: SettingsUpdate) => void | Promise<void>
}): BaseLLMProvider<LLMProvider> {
  const provider = settings.providers.find((p) => p.id === providerId)
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`)
  }
  if (expectedProviderType && provider.type !== expectedProviderType) {
    throw new Error(
      `Provider ${providerId} is ${provider.type}, but the model expects ${expectedProviderType}. Fix the model's provider settings.`,
    )
  }

  let oauthSnapshot =
    provider.type === 'openai-plan' ? provider.oauth : undefined
  const onProviderUpdate = setSettings
    ? async (targetProviderId: string, update: Partial<LLMProvider>) => {
        await setSettings((currentSettings) => {
          const currentProvider = currentSettings.providers.find(
            (item) => item.id === targetProviderId,
          )
          if (!currentProvider || currentProvider.type !== provider.type)
            return currentSettings
          if (
            currentProvider.type === 'openai-plan' &&
            !isEqual(currentProvider.oauth, oauthSnapshot)
          )
            return currentSettings
          if ('oauth' in update) oauthSnapshot = update.oauth
          return {
            ...currentSettings,
            providers: currentSettings.providers.map((item) =>
              item.id === targetProviderId
                ? ({ ...item, ...update } as LLMProvider)
                : item,
            ),
          }
        })
      }
    : undefined

  switch (provider.type) {
    case 'openai-plan': {
      return new OpenAICodexProvider({ ...provider }, onProviderUpdate)
    }
    case 'anthropic': {
      return new AnthropicProvider(provider)
    }
    case 'openai': {
      return new OpenAIAuthenticatedProvider(provider)
    }
    case 'gemini': {
      return new GeminiProvider(provider)
    }
    case 'openrouter': {
      return new OpenRouterProvider(provider)
    }
    case 'ollama': {
      return new OllamaProvider(provider)
    }
    case 'lm-studio': {
      return new LmStudioProvider(provider)
    }
    case 'deepseek': {
      return new DeepSeekStudioProvider(provider)
    }
    case 'perplexity': {
      return new PerplexityProvider(provider)
    }
    case 'mistral': {
      return new MistralProvider(provider)
    }
    case 'xai': {
      return new XaiProvider(provider)
    }
    case 'azure-openai': {
      return new AzureOpenAIProvider(provider)
    }
    case 'openai-compatible': {
      return new OpenAICompatibleProvider(provider)
    }
  }
}

export function getChatModelClient({
  modelId,
  settings,
  setSettings,
}: {
  modelId: string
  settings: SmartComposerSettings
  setSettings: (newSettings: SettingsUpdate) => void | Promise<void>
}): {
  providerClient: BaseLLMProvider<LLMProvider>
  model: ChatModel
} {
  const chatModel = settings.chatModels.find((model) => model.id === modelId)
  if (!chatModel) {
    throw new LLMModelNotFoundException(`Chat model ${modelId} not found`)
  }

  const providerClient = getProviderClient({
    providerId: chatModel.providerId,
    expectedProviderType: chatModel.providerType,
    settings,
    setSettings,
  })

  return {
    providerClient,
    model: chatModel,
  }
}
