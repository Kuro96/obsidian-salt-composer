<h1 align="center">Salt Composer</h1>

<p align="center">
  <a href="https://github.com/Kuro96/obsidian-salt-composer">Repository</a>
  ·
  <a href="https://github.com/Kuro96/obsidian-salt-composer/issues">Report Bug</a>
  ·
  <a href="https://github.com/Kuro96/obsidian-salt-composer/discussions">Discussions</a>
</p>

> [!IMPORTANT]
> Salt Composer is a standalone public fork of [glowingjade/obsidian-smart-composer](https://github.com/glowingjade/obsidian-smart-composer).
> Huge thanks to Heesu Suh, the glowingjade project, and every contributor who built the original Smart Composer.

> [!NOTE]
> **What's New**
>
> **v1.2.8** — Connect your Gemini account
>
> **v1.2.7** — Connect your Claude or OpenAI account directly (no API key required)
>
> **v1.2.6** — Support for GPT-5.2, Opus 4.5, Gemini 3, and Grok 4.1
>
> **🔌 MCP Support** — Connect Salt Composer to external tools and data sources via the [Model Context Protocol](https://modelcontextprotocol.io)

> ### Risks of connecting a Claude subscription
>
> As of January 2026, Anthropic has restricted third-party OAuth access, citing Terms of Service violations.
>
> Salt Composer's subscription connect uses the same OAuth-style flow that tools like OpenCode have used. There are reports of **Claude accounts being banned or restricted** when subscription OAuth is used via third-party clients (example: [https://github.com/anomalyco/opencode/issues/6930](https://github.com/anomalyco/opencode/issues/6930)). For **OpenAI (ChatGPT)** and **Google (Gemini)**, I have not seen comparable ban reports so far, but this is still not the same as official API access, and enforcement can change at any time.
>
> **Use at your own risk.** Keep usage limited to personal, interactive sessions and avoid any automation.

![SC1_Title.gif](https://github.com/user-attachments/assets/a50a1f80-39ff-4eba-8090-e3d75e7be98c)

Salt Composer helps you write efficiently with AI by referencing your vault content directly inside Obsidian. Inspired by Cursor AI and ChatGPT Canvas, it keeps note-taking and content creation in one place.

## Features

### Contextual Chat

Select files and folders as conversation context with `@<fname>` and get answers based on vault content.

### Multimedia Context

- Add website links and images as context
- Upload, drag and drop, or paste images
- YouTube transcripts are fetched automatically

### Apply Edit

Salt Composer suggests edits to your document and lets you apply them with one click.

### Vault Search (RAG)

- `Cmd+Shift+Enter` runs Vault Search
- Semantic search finds the most relevant notes

### Model Context Protocol (MCP)

Connect Salt Composer to external MCP servers and use third-party tools and data sources inside chat.

### Additional Features

- Custom model selection with local API key storage
- Local model support via [Ollama](https://ollama.ai)
- Project instructions via `AGENTS.md`
- Prompt templates with `/` in the chat view

## Getting Started

1. Open Obsidian Settings
2. Go to "Community plugins" and click "Browse"
3. Search for "Salt Composer" and install it
4. Enable the plugin
5. Configure Salt Composer in plugin settings

> [!TIP]
> Gemini API is currently the strongest free option for Salt Composer.

For setup details, visit the [repository](https://github.com/Kuro96/obsidian-salt-composer).

## Roadmap

Project tracking lives in the [GitHub Projects board](https://github.com/Kuro96/obsidian-salt-composer/projects?query=is%3Aopen).

## Feedback and Support

- Bug reports: [Issues](https://github.com/Kuro96/obsidian-salt-composer/issues)
- Feature requests: [Discussions](https://github.com/Kuro96/obsidian-salt-composer/discussions/categories/ideas-feature-requests)
- Show and tell: [Salt Composer Showcase](https://github.com/Kuro96/obsidian-salt-composer/discussions/categories/salt-composer-showcase)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and workflow details.

## Contributors

### Core Team

The original Smart Composer core contributors were instrumental in the project's foundation: [@glowingjade](https://github.com/glowingjade), [@kevin-on](https://github.com/kevin-on), [@realsnoopso](https://github.com/realsnoopso), and [@woosukji](https://github.com/woosukji).

### Additional Contributors

Thank you to everyone who has contributed to Smart Composer and Salt Composer.

## License

Salt Composer is licensed under the [GNU General Public License v3.0](LICENSE).

The original Smart Composer MIT license notice is preserved in [NOTICE](NOTICE).

## Acknowledgements

Salt Composer builds on the original Smart Composer project. If you want to support the upstream authors, see the original project's support links and updates from [@andy_suh_](https://x.com/andy_suh_).

For Salt Composer updates, watch or star this repository.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Kuro96/obsidian-salt-composer&type=Date)](https://star-history.com/#Kuro96/obsidian-salt-composer&Date)
