import isEqual from 'lodash.isequal'
import { App, Platform } from 'obsidian'

import { SmartComposerSettings } from '../../settings/schema/setting.types'
import {
  McpServerConfig,
  McpServerState,
  McpServerStatus,
  McpTool,
  McpToolCallResult,
} from '../../types/mcp.types'
import {
  ToolCallResponse,
  ToolCallResponseStatus,
} from '../../types/tool-call.types'
import { SkillManager } from '../skill/skillManager'
import { CommandsToolPack } from '../tools/packs/CommandsToolPack'
import { MetadataToolPack } from '../tools/packs/MetadataToolPack'
import { SearchToolPack } from '../tools/packs/SearchToolPack'
import { VaultToolPack } from '../tools/packs/VaultToolPack'
import { WebToolPack } from '../tools/packs/WebToolPack'
import { WorkspaceToolPack } from '../tools/packs/WorkspaceToolPack'
import { ToolRegistryImpl } from '../tools/ToolRegistryImpl'

import {
  BUILTIN_DANGER_ZONE_TOOLS,
  BUILTIN_READ_ONLY_TOOLS,
  BUILTIN_READ_WRITE_TOOLS,
  BuiltinToolTier,
  getBuiltinToolTier,
} from './builtin-tool-tiers'
import { McpNotAvailableException } from './exception'
import {
  DEFAULT_DELIMITER,
  getToolName,
  parseToolName,
  validateServerName,
} from './tool-name-utils'

export type SessionMode = 'read-only' | 'read-write'
export type { BuiltinToolTier }

export class McpManager {
  static readonly TOOL_NAME_DELIMITER = DEFAULT_DELIMITER
  static readonly VAULT_LIST_TOOL = 'vault_list'
  static readonly VAULT_READ_TOOL = 'vault_read'
  static readonly VAULT_WRITE_TOOL = 'vault_write'
  static readonly VAULT_EDIT_TOOL = 'vault_edit'
  static readonly VAULT_MKDIR_TOOL = 'vault_mkdir'
  static readonly VAULT_DELETE_TOOL = 'vault_delete'
  static readonly VAULT_APPEND_TOOL = 'vault_append'
  static readonly COMMANDS_LIST_TOOL = 'commands_list'
  static readonly TAGS_LIST_TOOL = 'tags_list'
  static readonly NOTE_OPEN_TOOL = 'note_open'
  static readonly COMMAND_EXECUTE_TOOL = 'command_execute'
  static readonly SEARCH_DATAVIEW_TOOL = 'search_dataview'

  static readonly READ_ONLY_TOOLS: string[] = BUILTIN_READ_ONLY_TOOLS
  static readonly READ_WRITE_TOOLS: string[] = BUILTIN_READ_WRITE_TOOLS
  static readonly DANGER_ZONE_TOOLS: string[] = BUILTIN_DANGER_ZONE_TOOLS
  static readonly getBuiltinToolTier = getBuiltinToolTier

  /** External MCP servers (stdio/SSE) require Node.js, unavailable on mobile */
  public readonly externalServersDisabled = !Platform.isDesktop

  private settings: SmartComposerSettings
  private app: App
  private unsubscribeFromSettings: () => void
  private defaultEnv: Record<string, string>

  private servers: McpServerState[] = [] // IMPORTANT: Always use this.updateServers() to update this array
  private activeToolCalls: Map<string, AbortController> = new Map()
  private subscribers = new Set<(servers: McpServerState[]) => void>()

  private availableToolsCache: McpTool[] | null = null
  private skillManager: SkillManager

  constructor({
    app,
    settings,
    registerSettingsListener,
  }: {
    app: App
    settings: SmartComposerSettings
    registerSettingsListener: (
      listener: (settings: SmartComposerSettings) => void,
    ) => () => void
  }) {
    this.app = app
    this.settings = settings
    this.unsubscribeFromSettings = registerSettingsListener((newSettings) => {
      this.handleSettingsUpdate(newSettings)
    })
    this.skillManager = new SkillManager({
      getSettings: () => this.settings,
      getVaultRoot: () => {
        const adapter = this.app.vault.adapter as {
          basePath?: string
          getBasePath?: () => string
        }
        return adapter.basePath ?? adapter.getBasePath?.()
      },
      getVault: () => this.app.vault,
      getVaultAdapter: () =>
        this.app.vault.adapter as {
          list: (
            path: string,
          ) => Promise<{ files: string[]; folders: string[] }>
          read: (path: string) => Promise<string>
        },
    })
  }

  public async initialize() {
    if (this.externalServersDisabled) {
      return
    }

    // Get default environment variables
    const { shellEnvSync } = await import('shell-env')
    this.defaultEnv = shellEnvSync()

    // Create MCP servers
    const servers = await Promise.all(
      this.settings.mcp.servers.map((serverConfig) =>
        this.connectServer(serverConfig),
      ),
    )
    this.updateServers(servers)
  }

  public cleanup() {
    // Disconnect all clients
    void Promise.all(
      this.servers
        .filter((s) => s.status === McpServerStatus.Connected)
        .map((s) => s.client.close()),
    )

    if (this.unsubscribeFromSettings) {
      this.unsubscribeFromSettings()
    }

    this.servers = []
    this.subscribers.clear()
    this.activeToolCalls.forEach((controller) => controller.abort())
    this.activeToolCalls.clear()
  }

  public getServers() {
    return this.servers
  }

  public subscribeServersChange(callback: (servers: McpServerState[]) => void) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  public async handleSettingsUpdate(settings: SmartComposerSettings) {
    this.settings = settings
    const updatedServers = settings.mcp.servers.map(
      (serverConfig: McpServerConfig): McpServerState => {
        const existingServer = this.servers.find(
          (s) => s.name === serverConfig.id,
        )
        if (
          existingServer &&
          isEqual(existingServer.config.parameters, serverConfig.parameters) &&
          existingServer.config.enabled === serverConfig.enabled
        ) {
          // Server is already up to date
          return {
            ...existingServer,
            config: serverConfig,
          }
        }
        return {
          name: serverConfig.id,
          config: serverConfig,
          status: McpServerStatus.Connecting,
        }
      },
    )

    this.updateServers(updatedServers)

    await Promise.all(
      updatedServers
        .filter((s) => s.status === McpServerStatus.Connecting)
        .map(async (s) => {
          const server = await this.connectServer(s.config)
          this.updateServers((prevServers) =>
            prevServers.map((prevServer) =>
              prevServer.name === server.name ? server : prevServer,
            ),
          )
        }),
    )
  }

  private notifySubscribers() {
    for (const cb of this.subscribers) cb(this.servers)
  }

  private updateServers(
    newServersOrUpdater?:
      | McpServerState[]
      | ((prevServers: McpServerState[]) => McpServerState[]),
  ) {
    const currentServers = this.servers
    const nextServers =
      typeof newServersOrUpdater === 'function'
        ? newServersOrUpdater(currentServers)
        : (newServersOrUpdater ?? currentServers)

    // Find clients that need to be disconnected
    const clientsToDisconnect = currentServers
      .filter((server) => server.status === McpServerStatus.Connected)
      .map((server) => server.client)
      .filter(
        (client) =>
          !nextServers.some(
            (server) =>
              server.status === McpServerStatus.Connected &&
              server.client === client,
          ),
      )

    // Disconnect clients in the background
    if (clientsToDisconnect.length > 0) {
      void Promise.all(clientsToDisconnect.map((client) => client.close()))
    }

    this.servers = nextServers
    this.availableToolsCache = null // Invalidate available tools cache
    this.notifySubscribers() // Should call after invalidating the cache
  }

  private async connectServer(
    serverConfig: McpServerConfig,
  ): Promise<McpServerState> {
    if (this.externalServersDisabled) {
      throw new McpNotAvailableException()
    }

    const { id: name, parameters: serverParams, enabled } = serverConfig

    if (!enabled) {
      return {
        name,
        config: serverConfig,
        status: McpServerStatus.Disconnected,
      }
    }

    try {
      validateServerName(name)
    } catch (error) {
      return {
        name,
        config: serverConfig,
        status: McpServerStatus.Error,
        error: error as Error,
      }
    }

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    )
    const client = new Client({ name, version: '1.0.0' })

    try {
      await client.connect(
        new StdioClientTransport({
          ...serverParams,
          env: {
            ...this.defaultEnv,
            ...(serverParams.env ?? {}),
          },
        }),
      )
    } catch (error) {
      return {
        name,
        config: serverConfig,
        status: McpServerStatus.Error,
        error: new Error(
          `Failed to connect to MCP server ${name}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      }
    }

    try {
      const toolList = await client.listTools()
      return {
        name,
        config: serverConfig,
        status: McpServerStatus.Connected,
        client,
        tools: toolList.tools,
      }
    } catch (error) {
      return {
        name,
        config: serverConfig,
        status: McpServerStatus.Error,
        error: new Error(
          `Failed to list tools for MCP server ${name}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      }
    }
  }

  public async listAvailableTools(opts?: {
    enableSkill?: boolean
    sessionMode?: SessionMode
  }): Promise<McpTool[]> {
    const sessionMode = opts?.sessionMode ?? 'read-write'

    if (this.availableToolsCache) {
      const filtered = this.filterToolsBySessionMode(
        this.availableToolsCache,
        sessionMode,
      )
      if (opts?.enableSkill === false) {
        return filtered
      }
      const skill = await this.getSkillTool()
      return [...filtered, skill]
    }

    // External MCP servers are only available on desktop
    const externalTools = this.externalServersDisabled
      ? []
      : (
          await Promise.all(
            this.servers.map(async (server): Promise<McpTool[]> => {
              if (server.status !== McpServerStatus.Connected) {
                return []
              }
              try {
                const toolList = await server.client.listTools()
                return toolList.tools
                  .filter(
                    (tool) => !server.config.toolOptions[tool.name]?.disabled,
                  )
                  .map((tool) => ({
                    ...tool,
                    name: getToolName(server.name, tool.name),
                  }))
              } catch (error) {
                console.error(
                  `Failed to list tools for MCP server ${server.name}: ${error instanceof Error ? error.message : String(error)}`,
                )
                return []
              }
            }),
          )
        ).flat()

    const availableTools = [...externalTools, ...this.listBuiltInTools()]

    this.availableToolsCache = [...availableTools]
    const filtered = this.filterToolsBySessionMode(availableTools, sessionMode)
    if (opts?.enableSkill === false) {
      return filtered
    }
    const skill = await this.getSkillTool()
    return [...filtered, skill]
  }

  private filterToolsBySessionMode(
    tools: McpTool[],
    sessionMode: SessionMode,
  ): McpTool[] {
    const enabledTools = tools.filter(
      (tool) =>
        getBuiltinToolTier(tool.name) === null ||
        this.settings.mcp.builtin?.toolOptions?.[tool.name]?.enabled !== false,
    )
    if (sessionMode === 'read-write') return enabledTools
    // read-only: remove built-in read-write and danger-zone tools
    return enabledTools.filter((tool) => {
      const tier = getBuiltinToolTier(tool.name)
      if (tier === null) return true // non-built-in MCP server tools are kept
      return tier === 'read-only'
    })
  }

  public listBuiltInTools(): McpTool[] {
    return this.createBuiltinRegistry().list()
  }

  private createBuiltinRegistry(): ToolRegistryImpl {
    const registry = new ToolRegistryImpl()
    new VaultToolPack(this.app).registerAll(registry)
    new WorkspaceToolPack(this.app).registerAll(registry)
    new CommandsToolPack(this.app).registerAll(registry)
    new SearchToolPack(this.app).registerAll(registry)
    new MetadataToolPack(this.app).registerAll(registry)
    new WebToolPack().registerAll(registry)
    return registry
  }

  /** Phase 3: 供 SkillToolAdapter / buildToolRegistry 使用 */
  public getSkillManager(): SkillManager {
    return this.skillManager
  }

  public async getSkillPromptSection(): Promise<string> {
    return this.skillManager.getPromptSection()
  }

  public async listSkills(opts?: { includeDisabled?: boolean }) {
    if (opts?.includeDisabled) {
      return this.skillManager.listAll()
    }
    return this.skillManager.list()
  }

  public async callTool({
    name,
    args,
    id,
    signal,
  }: {
    name: string
    args?: Record<string, unknown> | string | undefined
    id?: string
    signal?: AbortSignal
  }): Promise<
    Extract<
      ToolCallResponse,
      {
        status:
          | ToolCallResponseStatus.Success
          | ToolCallResponseStatus.Error
          | ToolCallResponseStatus.Aborted
      }
    >
  > {
    const toolAbortController = this.createToolAbortController(id)
    const compositeSignal = toolAbortController.signal
    const onAbort = () => toolAbortController.abort()
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })

    try {
      if (compositeSignal.aborted)
        return { status: ToolCallResponseStatus.Aborted }
      if (this.isVaultTool(name)) {
        if (this.settings.mcp.builtin?.toolOptions?.[name]?.enabled === false)
          throw new Error(`Tool ${name} is disabled.`)
        const parsedArgs: Record<string, unknown> | undefined =
          typeof args === 'string'
            ? args === ''
              ? {}
              : JSON.parse(args)
            : args
        const out = await this.callVaultTool(name, parsedArgs, compositeSignal)
        if (compositeSignal.aborted)
          return { status: ToolCallResponseStatus.Aborted }
        return {
          status: ToolCallResponseStatus.Success,
          data: {
            type: 'text',
            text: out,
          },
        }
      }

      if (name === SkillManager.TOOL_NAME) {
        const parsedArgs: Record<string, unknown> | undefined =
          typeof args === 'string'
            ? args === ''
              ? {}
              : JSON.parse(args)
            : args
        const skill = parsedArgs?.name
        if (typeof skill !== 'string' || skill.trim().length === 0) {
          throw new Error('Skill tool requires a non-empty "name" argument')
        }
        const out = await this.skillManager.execute(skill)
        if (compositeSignal.aborted)
          return { status: ToolCallResponseStatus.Aborted }
        return {
          status: ToolCallResponseStatus.Success,
          data: {
            type: 'text',
            text: out,
          },
        }
      }

      if (this.externalServersDisabled) {
        throw new McpNotAvailableException()
      }

      const { serverName, toolName } = parseToolName(name)
      const server = this.servers.find((server) => server.name === serverName)
      if (!server) {
        throw new Error(`MCP server ${serverName} not found`)
      }
      if (server.status !== McpServerStatus.Connected) {
        throw new Error(`MCP server ${serverName} is not connected`)
      }
      const { client } = server

      const parsedArgs: Record<string, unknown> | undefined =
        typeof args === 'string' ? (args === '' ? {} : JSON.parse(args)) : args

      const result = (await client.callTool(
        {
          name: toolName,
          arguments: parsedArgs,
        },
        undefined,
        {
          signal: compositeSignal,
        },
      )) as McpToolCallResult
      if (compositeSignal.aborted)
        return { status: ToolCallResponseStatus.Aborted }

      if (result.content.length === 0) {
        throw new Error('Tool call returned no content')
      }
      if (result.content[0].type !== 'text') {
        throw new Error(
          `Tool result with content type ${result.content[0].type} is not currently supported.`,
        )
      }
      if (result.isError) {
        return {
          status: ToolCallResponseStatus.Error,
          error: result.content[0].text,
        }
      }
      return {
        status: ToolCallResponseStatus.Success,
        data: {
          type: 'text',
          text: result.content[0].text,
        },
      }
    } catch (error) {
      if (compositeSignal.aborted || error.name === 'AbortError') {
        return {
          status: ToolCallResponseStatus.Aborted,
        }
      }

      // Handle other errors
      return {
        status: ToolCallResponseStatus.Error,
        error: error.message || 'Unknown error occurred',
      }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      this.releaseToolAbortController(id, toolAbortController)
    }
  }

  public createToolAbortController(id?: string): AbortController {
    const controller = new AbortController()
    if (id !== undefined) {
      this.activeToolCalls.get(id)?.abort()
      this.activeToolCalls.set(id, controller)
    }
    return controller
  }

  public releaseToolAbortController(
    id: string | undefined,
    controller: AbortController,
  ): void {
    if (id !== undefined && this.activeToolCalls.get(id) === controller)
      this.activeToolCalls.delete(id)
  }

  public abortToolCall(id: string): boolean {
    const toolAbortController = this.activeToolCalls.get(id)
    if (toolAbortController) {
      toolAbortController.abort()
      this.activeToolCalls.delete(id)
      return true
    }
    return false
  }

  private async getSkillTool(): Promise<McpTool> {
    const details = await this.skillManager.getToolDescription()
    return {
      name: SkillManager.TOOL_NAME,
      description: details.description,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: `The name of the skill from available_skills${details.hint}`,
          },
        },
        required: ['name'],
      },
    }
  }

  private isVaultTool(name: string): boolean {
    return getBuiltinToolTier(name) !== null
  }

  private async callVaultTool(
    name: string,
    args: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<string> {
    const registry = this.createBuiltinRegistry()
    const entry = registry.resolve(name)
    if (!entry) throw new Error(`Unsupported vault tool: ${name}`)
    return entry.handler(args ?? {}, { conversationId: '', signal })
  }
}
