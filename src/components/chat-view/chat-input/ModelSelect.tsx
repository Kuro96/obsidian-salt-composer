import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { useState } from 'react'

import { usePlugin } from '../../../contexts/plugin-context'
import { useSettings } from '../../../contexts/settings-context'

import {
  ReasoningEffortOption,
  getCodexFastModelPair,
  getReasoningEffortOptions,
} from './modelOptions'

export function ModelSelect() {
  const plugin = usePlugin()
  const { settings, setSettings } = useSettings()
  const [isModelOpen, setIsModelOpen] = useState(false)
  const [isEffortOpen, setIsEffortOpen] = useState(false)
  const selectedModel = settings.chatModels.find(
    (model) => model.id === settings.chatModelId,
  )
  const reasoningEfforts = selectedModel
    ? getReasoningEffortOptions(selectedModel)
    : []
  const currentEffort =
    selectedModel?.providerType === 'openai-plan' ||
    selectedModel?.providerType === 'openai'
      ? selectedModel.reasoning?.reasoning_effort
      : undefined
  const fastModelPair = selectedModel
    ? getCodexFastModelPair(settings.chatModels, selectedModel)
    : undefined
  const fastModeEnabled = selectedModel?.id === fastModelPair?.fast.id

  const setReasoningEffort = (reasoningEffort?: ReasoningEffortOption) => {
    if (!selectedModel) return
    const pairedModelIds = new Set(
      fastModelPair
        ? [fastModelPair.normal.id, fastModelPair.fast.id]
        : [selectedModel.id],
    )
    const latestSettings = plugin.settings
    void setSettings({
      ...latestSettings,
      chatModels: latestSettings.chatModels.map((model) => {
        const isSelectedModel = model.id === selectedModel.id
        if (!isSelectedModel && !pairedModelIds.has(model.id)) return model
        if (model.providerType === 'openai-plan') {
          return {
            ...model,
            reasoning: {
              ...model.reasoning,
              reasoning_effort: reasoningEffort,
            },
          }
        }
        if (model.providerType === 'openai') {
          return {
            ...model,
            reasoning: {
              ...model.reasoning,
              enabled: true,
              reasoning_effort: reasoningEffort,
            },
          }
        }
        return model
      }),
    })
  }

  const setFastMode = (enabled: boolean) => {
    if (!fastModelPair) return
    const targetModel = enabled ? fastModelPair.fast : fastModelPair.normal
    const latestSettings = plugin.settings
    void setSettings({
      ...latestSettings,
      chatModelId: targetModel.id,
    })
  }

  return (
    <div className="smtcmp-chat-input-model-controls">
      <DropdownMenu.Root open={isModelOpen} onOpenChange={setIsModelOpen}>
        <DropdownMenu.Trigger className="smtcmp-chat-input-model-select">
          <div className="smtcmp-chat-input-model-select__model-name">
            {settings.chatModelId}
          </div>
          <div className="smtcmp-chat-input-model-select__icon">
            {isModelOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </div>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content className="smtcmp-popover">
            <ul>
              {settings.chatModels
                .filter(({ enable }) => enable ?? true)
                .map((chatModelOption) => (
                  <DropdownMenu.Item
                    key={chatModelOption.id}
                    onSelect={() => {
                      const latestSettings = plugin.settings
                      void setSettings({
                        ...latestSettings,
                        chatModelId: chatModelOption.id,
                      })
                    }}
                    asChild
                  >
                    <li>{chatModelOption.id}</li>
                  </DropdownMenu.Item>
                ))}
            </ul>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {reasoningEfforts.length > 0 && (
        <DropdownMenu.Root open={isEffortOpen} onOpenChange={setIsEffortOpen}>
          <DropdownMenu.Trigger
            className="smtcmp-chat-input-model-select smtcmp-chat-input-effort-select"
            aria-label={`Reasoning effort: ${currentEffort ?? 'default'}`}
          >
            <span>
              <span className="smtcmp-chat-input-effort-select__prefix">
                Effort:{' '}
              </span>
              {currentEffort ?? 'default'}
            </span>
            <span className="smtcmp-chat-input-model-select__icon">
              {isEffortOpen ? (
                <ChevronUp size={10} />
              ) : (
                <ChevronDown size={10} />
              )}
            </span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="smtcmp-popover">
              <DropdownMenu.RadioGroup value={currentEffort ?? 'default'}>
                <ul>
                  <DropdownMenu.RadioItem
                    value="default"
                    onSelect={() => setReasoningEffort()}
                    asChild
                  >
                    <li>
                      <DropdownMenu.ItemIndicator
                        className="smtcmp-popover-radio-indicator"
                        forceMount
                      >
                        <Check size={12} />
                      </DropdownMenu.ItemIndicator>
                      <span>default</span>
                    </li>
                  </DropdownMenu.RadioItem>
                  {reasoningEfforts.map((effort) => (
                    <DropdownMenu.RadioItem
                      key={effort}
                      value={effort}
                      onSelect={() => setReasoningEffort(effort)}
                      asChild
                    >
                      <li>
                        <DropdownMenu.ItemIndicator
                          className="smtcmp-popover-radio-indicator"
                          forceMount
                        >
                          <Check size={12} />
                        </DropdownMenu.ItemIndicator>
                        <span>{effort}</span>
                      </li>
                    </DropdownMenu.RadioItem>
                  ))}
                </ul>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}

      {fastModelPair && (
        <button
          type="button"
          className="smtcmp-chat-input-model-select smtcmp-chat-input-fast-toggle"
          aria-label="Fast mode"
          title={`${fastModeEnabled ? 'Disable' : 'Enable'} Fast mode`}
          aria-pressed={fastModeEnabled}
          onClick={() => setFastMode(!fastModeEnabled)}
        >
          <Zap size={11} />
          <span>Fast</span>
        </button>
      )}
    </div>
  )
}
