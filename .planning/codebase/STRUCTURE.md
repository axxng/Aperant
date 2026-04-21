# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```
Currents/                              # Monorepo root
├── apps/
│   └── desktop/                       # Sole application — Electron desktop app
│       ├── prompts/                   # Agent system prompts (.md files)
│       │   ├── github/                # GitHub-specific prompts + partials
│       │   └── mcp_tools/             # MCP tool prompts
│       ├── resources/                 # App icons and binary resources
│       ├── scripts/                   # Build and packaging scripts
│       ├── e2e/                       # Playwright E2E test config
│       └── src/
│           ├── main/                  # Electron main process (Node.js)
│           │   ├── ai/                # TypeScript AI agent layer (Vercel AI SDK v6)
│           │   ├── agent/             # Agent manager, queue, process, state, events
│           │   ├── claude-profile/    # Multi-profile OAuth credential management
│           │   ├── terminal/          # PTY daemon, lifecycle, session handling
│           │   ├── ipc-handlers/      # 40+ domain-specific IPC handler modules
│           │   ├── platform/          # Cross-platform OS abstraction
│           │   ├── services/          # Session recovery, profile service
│           │   ├── changelog/         # Changelog generation
│           │   ├── insights/          # Insights service
│           │   ├── integrations/      # Third-party integration helpers
│           │   ├── updater/           # Auto-update logic
│           │   └── utils/             # Shared main-process utilities
│           ├── preload/               # Electron preload scripts (contextBridge)
│           │   └── api/
│           │       └── modules/       # Per-domain electronAPI wrappers
│           ├── renderer/              # React UI (Vite-bundled)
│           │   ├── components/        # Feature UI components
│           │   ├── stores/            # 20+ Zustand state stores
│           │   ├── contexts/          # React contexts (ViewStateContext)
│           │   ├── hooks/             # Custom hooks (useIpc, useTerminal, etc.)
│           │   ├── lib/               # Renderer-side utilities
│           │   └── styles/            # CSS / Tailwind styles
│           ├── shared/                # Code shared between main and renderer
│           │   ├── constants/         # Phase protocol, models, IPC channels, themes
│           │   ├── i18n/locales/      # en/*.json, fr/*.json translation files
│           │   ├── state-machines/    # XState machines (task, terminal, roadmap, PR)
│           │   ├── types/             # 19+ TypeScript type definition files
│           │   └── utils/             # Pure utilities (debug-logger, ANSI sanitizer, etc.)
│           ├── types/                 # Additional TypeScript declarations
│           └── __mocks__/             # Vitest global mocks
├── .design-system/                    # Standalone design system (components, theme, animations)
├── .planning/                         # GSD planning documents (gitignored)
│   └── codebase/                      # Codebase map documents
├── .github/                           # GitHub Actions workflows and issue templates
├── .husky/                            # Pre-commit hooks (Biome lint-staged)
├── guides/                            # Contributor documentation
├── scripts/                           # Root-level build/release scripts (bump-version.js)
└── package.json                       # Root workspace package.json
```

## Directory Purposes

**`apps/desktop/src/main/ai/`:**
- Purpose: Complete TypeScript AI agent runtime — the core engine of the product
- Contains: Provider factory, session runner, orchestrators, tools, security, config, memory, MCP client, schema validators
- Key files:
  - `ai/session/runner.ts` — `runAgentSession()` using `streamText()`
  - `ai/orchestration/build-orchestrator.ts` — Planner→Coder→QA lifecycle
  - `ai/orchestration/spec-orchestrator.ts` — Spec creation pipeline
  - `ai/providers/factory.ts` — `createProvider()` factory for 10+ AI providers
  - `ai/config/agent-configs.ts` — `AGENT_CONFIGS` registry (25+ agent types)
  - `ai/tools/builtin/` — 8 builtin tools (bash.ts, read.ts, write.ts, edit.ts, glob.ts, grep.ts, web-fetch.ts, web-search.ts)
  - `ai/security/bash-validator.ts` — Denylist-based command validation
  - `ai/memory/memory-service.ts` — libSQL-backed semantic memory store
  - `ai/agent/worker.ts` — Worker thread entry point

**`apps/desktop/src/main/agent/`:**
- Purpose: Manages agent process lifecycle outside of the AI layer itself
- Contains: `agent-manager.ts` (facade), `agent-process.ts` (worker spawning), `agent-queue.ts` (ideation/roadmap queue), `agent-state.ts`, `agent-events.ts`, phase/task event parsers
- Key files: `agent-manager.ts`, `agent-process.ts`, `agent-events.ts`

**`apps/desktop/src/main/claude-profile/`:**
- Purpose: Multi-profile credential management and automatic account switching
- Contains: `credential-utils.ts` (OS keychain), `token-refresh.ts` (OAuth lifecycle), `usage-monitor.ts`, `profile-scorer.ts` (rate-limit-aware scoring), `operation-registry.ts`
- Key files: `token-refresh.ts`, `credential-utils.ts`, `profile-scorer.ts`

**`apps/desktop/src/main/ipc-handlers/`:**
- Purpose: Domain-organized IPC handler registration — all `ipcMain.handle()` calls live here
- Contains: 25+ handler files organized by domain (github/, gitlab/, task/, terminal/, roadmap/, ideation/, context/, shared/)
- Key files: `index.ts` (barrel registration), `task-handlers.ts`, `github-handlers.ts`, `profile-handlers.ts`

**`apps/desktop/src/main/terminal/`:**
- Purpose: Full PTY-based terminal integration
- Contains: `pty-daemon-client.ts`, `pty-manager.ts`, `terminal-lifecycle.ts`, `session-handler.ts`, `claude-integration-handler.ts`
- Key files: `terminal-lifecycle.ts`, `pty-manager.ts`

**`apps/desktop/src/main/platform/`:**
- Purpose: Cross-platform OS abstraction — the single place for all `process.platform` logic
- Contains: `index.ts` (exports `isWindows()`, `isMacOS()`, `isLinux()`, `findExecutable()`, `killProcessGracefully()`), `paths.ts`, `types.ts`
- Key files: `index.ts`

**`apps/desktop/src/renderer/components/`:**
- Purpose: All React feature UI components organized by domain
- Contains: Subdirectories per feature: `github-issues/`, `github-prs/`, `gitlab-issues/`, `gitlab-merge-requests/`, `onboarding/`, `settings/`, `task-detail/`, `task-form/`, `terminal/`, `ideation/`, `roadmap/`, `changelog/`, `context/`, `workspace/`, `shared/`, `ui/`
- Key files: `App.tsx` (root), `KanbanBoard.tsx`, `TerminalGrid.tsx`, `Sidebar.tsx`

**`apps/desktop/src/renderer/stores/`:**
- Purpose: All Zustand global state stores — one per domain
- Contains: `task-store.ts`, `project-store.ts`, `settings-store.ts`, `terminal-store.ts`, `claude-profile-store.ts`, `insights-store.ts`, `roadmap-store.ts`, `ideation-store.ts`, `kanban-settings-store.ts`, `changelog-store.ts`, `context-store.ts`, `github/`, `gitlab/`, plus rate-limit, auth-failure, download, release stores
- Key files: `task-store.ts`, `project-store.ts`, `settings-store.ts`

**`apps/desktop/src/shared/`:**
- Purpose: Zero-dependency shared code importable from both Main and Renderer
- Contains: Types, constants, i18n, state machines, pure utilities
- Key files: `constants/phase-protocol.ts`, `constants/models.ts`, `constants/ipc.ts`, `state-machines/task-machine.ts`, `types/index.ts`

**`apps/desktop/prompts/`:**
- Purpose: Agent system prompt files loaded at runtime by `prompt-loader.ts`
- Contains: `planner.md`, `coder.md`, `coder_recovery.md`, `qa_reviewer.md`, `qa_fixer.md`, `spec_gatherer/*.md`, `spec_writer.md`, `spec_critic.md`, `complexity_assessor.md`, `github/*.md`
- Key note: These are loaded from disk at runtime — changes take effect immediately without rebuild

**`apps/desktop/src/shared/i18n/locales/`:**
- Purpose: Localization strings for all UI text
- Contains: `en/*.json`, `fr/*.json` — namespaces: `common`, `navigation`, `settings`, `dialogs`, `tasks`, `errors`, `onboarding`, `welcome`
- Key rule: ALL new UI strings must be added to both `en/` and `fr/` files

## Key File Locations

**Entry Points:**
- `apps/desktop/src/main/index.ts`: Electron main process entry, app lifecycle, window creation
- `apps/desktop/src/main/ai/agent/worker.ts`: Agent worker thread entry point
- `apps/desktop/src/renderer/App.tsx`: React root component, all view routing

**Configuration:**
- `apps/desktop/tsconfig.json`: TypeScript config with path aliases (`@/*`, `@shared/*`, `@features/*`, etc.)
- `apps/desktop/vite.config.ts`: Vite build config (electron-vite)
- `apps/desktop/electron.vite.config.ts`: Electron-specific Vite config
- `apps/desktop/biome.json`: Linting and formatting config (Biome 2)
- `apps/desktop/vitest.config.ts`: Unit test config

**Core Logic:**
- `apps/desktop/src/main/ai/session/runner.ts`: Core `runAgentSession()` runtime
- `apps/desktop/src/main/ai/orchestration/build-orchestrator.ts`: Build pipeline orchestration
- `apps/desktop/src/main/ai/providers/factory.ts`: AI provider factory
- `apps/desktop/src/main/agent/agent-manager.ts`: Agent lifecycle facade
- `apps/desktop/src/main/ipc-setup.ts`: IPC handler registration hub
- `apps/desktop/src/shared/constants/phase-protocol.ts`: Phase state machine protocol

**Testing:**
- `apps/desktop/src/main/ai/**/__tests__/`: Co-located unit tests for AI layer
- `apps/desktop/src/__tests__/integration/`: Integration tests
- `apps/desktop/src/__tests__/e2e/`: E2E Playwright tests
- `apps/desktop/src/renderer/components/**/__tests__/`: Component tests

## Naming Conventions

**Files:**
- kebab-case for all TypeScript files: `agent-manager.ts`, `build-orchestrator.ts`, `task-store.ts`
- Test files use `*.test.ts` or placed in `__tests__/` subdirectory
- React components: PascalCase filenames matching the exported component: `KanbanBoard.tsx`, `TaskDetailModal.tsx`
- Handler files: `{domain}-handlers.ts` pattern: `github-handlers.ts`, `task-handlers.ts`

**Directories:**
- kebab-case: `ipc-handlers/`, `claude-profile/`, `state-machines/`
- `__tests__/` subdirectories for test co-location within source modules

**Exports:**
- Barrel files (`index.ts`) used at module boundaries to control public API
- Named exports preferred over default exports for utilities and services
- React components use default exports

## Where to Add New Code

**New AI Agent Type:**
- Add to `AGENT_CONFIGS` in `apps/desktop/src/main/ai/config/agent-configs.ts`
- Add system prompt `.md` to `apps/desktop/prompts/`
- Add runner if needed in `apps/desktop/src/main/ai/runners/`
- Add phase config in `apps/desktop/src/main/ai/config/phase-config.ts`

**New IPC Handler Domain:**
- Create `apps/desktop/src/main/ipc-handlers/{domain}-handlers.ts`
- Register in `apps/desktop/src/main/ipc-handlers/index.ts`
- Add preload API module in `apps/desktop/src/preload/api/modules/{domain}-api.ts`
- Export from `apps/desktop/src/preload/api/modules/index.ts`

**New Feature UI View:**
- Add component directory `apps/desktop/src/renderer/components/{feature}/`
- Create Zustand store in `apps/desktop/src/renderer/stores/{feature}-store.ts`
- Add view to `App.tsx` and `Sidebar.tsx`
- Add i18n keys to both `apps/desktop/src/shared/i18n/locales/en/*.json` and `fr/*.json`

**New Zustand Store:**
- Create in `apps/desktop/src/renderer/stores/{domain}-store.ts`
- Use `create()` from `zustand` with typed state interface
- Import and initialize in `App.tsx` if startup data load is needed

**New Shared Type:**
- Add to appropriate file in `apps/desktop/src/shared/types/`
- Re-export from `apps/desktop/src/shared/types/index.ts` if it's a primary type

**New Builtin Tool:**
- Implement in `apps/desktop/src/main/ai/tools/builtin/{name}.ts`
- Register in `apps/desktop/src/main/ai/tools/build-registry.ts`
- Add to `ALL_BUILTIN_TOOLS` in `apps/desktop/src/main/ai/config/agent-configs.ts` if universally available

**Utilities:**
- Main-process-only: `apps/desktop/src/main/utils/`
- Renderer-only: `apps/desktop/src/renderer/lib/`
- Shared (both): `apps/desktop/src/shared/utils/`

## Special Directories

**`.auto-claude/`:**
- Purpose: Project-level runtime data (specs, plans, agent logs, GitHub state)
- Generated: Yes — created by agents at runtime
- Committed: No — gitignored per project

**`.planning/`:**
- Purpose: GSD planning documents and codebase maps
- Generated: By GSD commands
- Committed: Depends on project convention

**`apps/desktop/src/__mocks__/`:**
- Purpose: Vitest global mock overrides for Electron APIs and Node modules
- Generated: No
- Committed: Yes

**`apps/desktop/out/`:**
- Purpose: Compiled output from electron-vite build
- Generated: Yes — by `npm run build`
- Committed: No

**`.design-system/`:**
- Purpose: Standalone design system reference with components, theme, and animations
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-21*
