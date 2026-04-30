# Contributing to Obsidian Salt Composer

We welcome contributions to Obsidian Salt Composer. Thanks for helping improve the project.

## Development Workflow

1. Clone the repository into your Obsidian vault's plugins directory:

   ```
   git clone https://github.com/Kuro96/obsidian-salt-composer.git /path/to/your/vault/.obsidian/plugins/obsidian-salt-composer
   ```

2. Move into the plugin directory:

   ```
   cd /path/to/your/vault/.obsidian/plugins/obsidian-salt-composer
   ```

3. Install dependencies and start the dev server:

   ```
   npm install
   npm run dev
   ```

4. Reload Obsidian manually, or use the [Hot Reload plugin](https://github.com/pjeby/hot-reload) during development.

## Database Development

We use PGlite and Drizzle ORM for database work.

### Updating the Database Schema

1. Update `src/database/schema.ts`.
2. Generate migration files:

   ```
   npx drizzle-kit generate --name <migration-name>
   ```

3. Review the generated files in `drizzle`.
4. Compile migrations into `src/database/migrations.json`:

   ```
   npm run migrate:compile
   ```

## Sending a Pull Request

Before sending a PR:

1. Fork or branch from `main`.
2. Run `npm install`.
3. Add tests when needed.
4. Ensure `npm test` passes.
5. Check `npm run type:check`.
6. Check `npm run lint:check`.

## Development Issues and Solutions

See the issue tracker and discussions for help:

1. [Issue Tracker](https://github.com/Kuro96/obsidian-salt-composer/issues)
2. [GitHub Discussions](https://github.com/Kuro96/obsidian-salt-composer/discussions)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE). Contributions are also licensed under GPLv3.

## Deployment (Maintainers Only)

Releases are tag-driven. Create and push a tag such as `v1.2.3`, and the release workflow will build the plugin, publish the release, and open a version-bump PR to `main`.
