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

> ### OpenAI subscription connect
>
> Salt Composer only exposes subscription connect for OpenAI (ChatGPT/Codex). Claude and Gemini remain available through normal API-key provider setup.
>
> Subscription connect uses an OAuth-style flow and is not the same as official API-key access. Use it for personal, interactive sessions and use API keys for provider billing or automation.

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

1. Download the latest release from this repository.
2. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/salt-composer/` in your vault.
3. Open Obsidian Settings, go to Community plugins, and enable Salt Composer.
4. Configure providers, subscription connect, MCP servers, and tool approval policy in Salt Composer settings.

For contributor setup, see [CONTRIBUTING.md](CONTRIBUTING.md).

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

## Fork Notice

Salt Composer is distributed as an independent fork. User-facing documentation, release tracking, issues, and discussions for this fork live in this repository. Historical upstream attribution is preserved here and in [NOTICE](NOTICE).

## License

Salt Composer is licensed under the [GNU General Public License v3.0](LICENSE).

The original Smart Composer MIT license notice is preserved in [NOTICE](NOTICE).

## Acknowledgements

Salt Composer builds on the original Smart Composer project. If you want to support the upstream authors, see the original project's support links and updates from [@andy_suh_](https://x.com/andy_suh_).
