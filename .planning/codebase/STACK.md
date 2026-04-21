# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- TypeScript 5.9.x - All application code (main process, renderer, preload, shared, web API)

**Secondary:**
- CSS - Tailwind CSS v4 styling
- HTML - Electron renderer entry point (`apps/desktop/src/renderer/index.html`)

## Runtime

**Environment:**
- Node.js >= 24.0.0 (enforced in `package.json` `engines`)
- Electron 40.0.0 — Desktop host runtime (`apps/desktop`)

**Package Manager:**
- npm >= 10.0.0
- Lockfile: `package-lock.json` and `pnpm-lock.yaml` (both present at root)
- npm workspaces: `apps/*`, `libs/*`

## Frameworks

**Core (Desktop):**
- Electron 40.0.0 - Desktop application host
- React 19.2.x - UI rendering (`apps/desktop/src/renderer/`)
- Vercel AI SDK v6 (`ai` ^6.0.116) - All AI agent interactions; provides `streamText()`, `generateText()`, `tool()`, `stepCountIs()`

**Core (Web):**
- React 19.1.x - Web SaaS UI (`apps/web/src/`)
- React Router DOM 7.6.x - Client-side routing
- Vite 7.x - Build tooling for web app

**State Management:**
- Zustand 5.0.x - 24+ stores in `apps/desktop/src/renderer/stores/` and `apps/web/`
- XState 5.28.x - Task state machine in renderer (`apps/desktop/src/renderer/stores/task-store.ts`, `terminal-store.ts`)

**Build/Dev (Desktop):**
- electron-vite 5.0.x - Vite-based build for Electron main/preload/renderer
- Vite 7.2.x - Underlying bundler
- electron-builder 26.8.x - Packaging for macOS, Windows, Linux

**Testing:**
- Vitest 4.1.x - Unit and integration tests (`apps/desktop/`)
- Playwright 1.58.x - E2E tests (`apps/desktop/e2e/`)
- React Testing Library 16.3.x - Component testing

**Linting/Formatting:**
- Biome 2.4.7 - Linter + formatter (replaces ESLint + Prettier); config at `apps/desktop/biome.jsonc`
- Husky 9.x + lint-staged 16.x - Pre-commit hooks running Biome on staged files

## Key Dependencies

**AI Provider Adapters (all via Vercel AI SDK):**
- `@ai-sdk/anthropic` ^3.0.58 - Anthropic Claude (primary)
- `@ai-sdk/openai` ^3.0.41 - OpenAI + Codex
- `@ai-sdk/google` ^3.0.43 - Google Gemini
- `@ai-sdk/amazon-bedrock` ^4.0.77 - AWS Bedrock
- `@ai-sdk/azure` ^3.0.42 - Azure OpenAI
- `@ai-sdk/mistral` ^3.0.24 - Mistral AI
- `@ai-sdk/groq` ^3.0.29 - Groq
- `@ai-sdk/xai` ^3.0.67 - xAI Grok
- `@ai-sdk/openai-compatible` ^2.0.35 - Generic OpenAI-compatible (Ollama, Z.AI)
- `@openrouter/ai-sdk-provider` ^2.3.1 - OpenRouter
- `@ai-sdk/mcp` ^1.0.25 - MCP client integration
- `@anthropic-ai/sdk` ^0.78.0 - Used only for OAuth token handling (NOT for agent calls)

**Terminal:**
- `@lydell/node-pty` ^1.1.0 - PTY (pseudo-terminal) native addon; loaded as external, unpacked from ASAR

**UI Components:**
- Radix UI (12 packages) - Headless accessible primitives; used via `apps/desktop/src/renderer/` and `apps/web/`
- `@xterm/xterm` ^6.0.0 - Terminal emulator in renderer
- `@xterm/addon-webgl`, `addon-fit`, `addon-web-links`, `addon-serialize` - xterm.js addons
- `@dnd-kit/core`, `@dnd-kit/sortable` - Drag-and-drop for kanban
- `lucide-react` - Icon library
- `motion` ^12.36.0 - Framer Motion animations
- `@tanstack/react-virtual` ^3.13.22 - Virtualized lists

**Database / Memory:**
- `@libsql/client` ^0.17.0 - libSQL client (Turso-compatible); supports local file and cloud sync modes
- `web-tree-sitter` ^0.26.7 - AST parsing for code chunking in memory graph

**MCP:**
- `@modelcontextprotocol/sdk` ^1.27.1 - MCP server/client protocol

**Utilities:**
- `zod` ^4.3.6 - Schema validation (tool input schemas, API schemas)
- `zustand` ^5.0.11 - State management
- `chokidar` ^5.0.0 - File watching (plan file watcher in `src/main/file-watcher.ts`)
- `minimatch` ^10.2.4 - Glob pattern matching
- `proper-lockfile` ^4.1.2 - File-based mutual exclusion
- `uuid` ^13.0.0 - Unique ID generation
- `semver` ^7.7.4 - Version comparison for auto-updater
- `react-markdown` ^10.1.0 + `remark-gfm` + `rehype-raw` + `rehype-sanitize` - Markdown rendering
- `i18next` ^25.8.18 + `react-i18next` ^16.5.8 - Internationalization

**Monitoring:**
- `@sentry/electron` ^7.10.0 - Error tracking (both main and renderer process)

**Infrastructure:**
- `electron-updater` ^6.8.3 - Auto-updates via GitHub Releases
- `electron-log` ^5.4.3 - Persistent file logging in main process
- `dotenv` ^17.3.1 - Environment variable loading at dev time

**Web App Only:**
- `resend` ^6.10.0 - Transactional email for OTP auth (`apps/web/api/_lib/auth/email.ts`)
- `react-router-dom` ^7.6.1 - Routing
- `@vercel/node` - Vercel serverless function types

## Configuration

**Environment:**
- Desktop: `.env` file at `apps/desktop/.env` (loaded by dotenv in `electron.vite.config.ts`); template at `.env.example`
- Key desktop env vars: `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`, `SERPER_API_KEY`, `DEBUG`
- Web: environment variables on Vercel; key vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `RESEND_API_KEY`, `JWT_SECRET`, `GITHUB_TOKEN`, `OTP_FROM_EMAIL`
- Secrets embedded at build time in desktop via Vite `define` in `electron.vite.config.ts`

**Build:**
- Desktop: `apps/desktop/electron.vite.config.ts` — main/preload/renderer split
- Desktop packages: `apps/desktop/build` section in `package.json` (electron-builder)
- Web: `apps/web/vite.config.ts`
- TypeScript: `apps/desktop/tsconfig.json` — strict mode, ES2022 target, bundler module resolution
- Path aliases (desktop): `@/*` → `src/renderer/*`, `@shared/*` → `src/shared/*`, `@preload/*` → `src/preload/*`, `@features/*`, `@components/*`, `@hooks/*`, `@lib/*`

## Platform Requirements

**Development:**
- Node.js >= 24.0.0
- npm >= 10.0.0
- GitHub CLI (`gh`) must be installed for GitHub OAuth flow
- Ollama (optional) for local embedding models in memory system

**Production:**
- Desktop: macOS (dmg/zip), Windows (nsis/zip), Linux (AppImage/deb/flatpak)
- macOS requires hardened runtime + entitlements (`resources/entitlements.mac.plist`)
- Linux flatpak uses `org.freedesktop.Platform` 25.08
- Web: Deployed on Vercel (see `apps/web/vercel.json`)
- Auto-updates distributed through GitHub Releases (`owner: AndyMik90, repo: Aperant`)

---

*Stack analysis: 2026-04-21*
