import { Check, CircleMinus } from 'lucide-react'
import { App } from 'obsidian'

import { PROVIDER_TYPES_INFO } from '../../../constants'
import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { LLMProvider } from '../../../types/provider.types'
import { ConfirmModal } from '../../modals/ConfirmModal'
import { ConnectOpenAIPlanModal } from '../modals/ConnectOpenAIPlanModal'

type PlanConnectionsSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

const OPENAI_PLAN_PROVIDER_ID = PROVIDER_TYPES_INFO['openai-plan']
  .defaultProviderId as string

export function PlanConnectionsSection({
  app,
  plugin,
}: PlanConnectionsSectionProps) {
  const { settings, setSettings } = useSettings()

  const openAIPlanProvider = settings.providers.find(
    (p): p is Extract<LLMProvider, { type: 'openai-plan' }> =>
      p.id === OPENAI_PLAN_PROVIDER_ID && p.type === 'openai-plan',
  )

  const isOpenAIConnected = !!openAIPlanProvider?.oauth?.accessToken

  const disconnect = () => {
    new ConfirmModal(app, {
      title: 'Disconnect subscription',
      message: 'Disconnect OpenAI from Salt Composer?',
      ctaText: 'Disconnect',
      onConfirm: async () => {
        await setSettings({
          ...settings,
          providers: settings.providers.map((p) => {
            if (p.id !== OPENAI_PLAN_PROVIDER_ID || p.type !== 'openai-plan') {
              return p
            }
            return {
              ...p,
              oauth: undefined,
            }
          }),
        })
      },
    }).open()
  }

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">Connect your subscription</div>

      <div className="smtcmp-settings-desc">
        Connect your OpenAI subscription to use Codex from your ChatGPT plan.
        Claude and Gemini remain available as normal API-key providers.
        <br />
      </div>

      <div className="smtcmp-plan-connection-grid">
        <div className="smtcmp-plan-connection-card">
          <div className="smtcmp-plan-connection-card-header">
            <div className="smtcmp-plan-connection-card-title">OpenAI</div>
            <PlanConnectionStatusBadge connected={isOpenAIConnected} />
          </div>

          <div className="smtcmp-plan-connection-card-desc">
            Uses your Codex usage from your ChatGPT plan.
            <br />
            <a
              href="https://chatgpt.com/codex/settings/usage"
              target="_blank"
              rel="noopener noreferrer"
            >
              Check Codex usage and limits
            </a>
          </div>

          <div className="smtcmp-plan-connection-card-actions">
            {!isOpenAIConnected && (
              <button
                className="mod-cta"
                onClick={() => new ConnectOpenAIPlanModal(app, plugin).open()}
              >
                Connect
              </button>
            )}
            {isOpenAIConnected && (
              <button onClick={disconnect}>Disconnect</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlanConnectionStatusBadge({ connected }: { connected: boolean }) {
  const statusConfig = connected
    ? {
        icon: <Check size={16} />,
        label: 'Connected',
        statusClass: 'smtcmp-mcp-server-status-badge--connected',
      }
    : {
        icon: <CircleMinus size={14} />,
        label: 'Disconnected',
        statusClass: 'smtcmp-mcp-server-status-badge--disconnected',
      }

  return (
    <div
      className={`smtcmp-mcp-server-status-badge ${statusConfig.statusClass}`}
    >
      {statusConfig.icon}
      <div className="smtcmp-mcp-server-status-badge-label">
        {statusConfig.label}
      </div>
    </div>
  )
}
