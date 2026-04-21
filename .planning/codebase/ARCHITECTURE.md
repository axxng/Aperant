# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Multi-process Electron application with a layered AI agent orchestration system

**Key Characteristics:**
- Three-process Electron model: Main (Node.js), Renderer (React), Preload (bridge)
- AI agents run in isolated `worker_threads` inside the Main process to avoid blocking
- Vercel AI SDK v6 (`ai` package) is the exclusive AI interaction layer — never `@anthropic-ai/sdk` directly
- IPC-driven communication: renderer calls `window.electronAPI.*`, main handles in domain-specific handler modules
- State machines (XState) govern task lifecycle; Zustand manages renderer UI state
- Git worktrees provide full isolation for every agent build job

## Layers

**Renderer (UI Layer):**
- Purpose: React-based UI presenting kanban board, terminals, settings, and all feature views
- Location: `apps/desktop/src/renderer/`
- Contains: React components, Zustand stores, custom hooks, XState machines (view-side)
- Depends on: Preload API (`window.electronAPI`), shared types/constants
- Used by: End user directly; never communicates with Node.js APIs directly

**Preload (Bridge Layer):**
- Purpose: Exposes a safe, typed `electronAPI` surface from Main to Renderer via `contextBridge`
- Location: `apps/desktop/src/preload/`
- Contains: `api/modules/` per-domain API wrappers, barrel re-exports
- Depends on: Electron `ipcRenderer`
- Used by: Renderer (`window.electronAPI.*`)

**Main (Application Layer):**
- Purpose: Electron main process — hosts all Node.js services, IPC handlers, and AI orchestration
- Location: `apps/desktop/src/main/`
- Contains: IPC handler modules, agent manager, terminal manager, project/settings stores, platform abstraction, services
- Depends on: AI layer, claude-profile, platform, shared types
- Used by: Preload (via IPC)

**AI Agent Layer:**
- Purpose: Full TypeScript AI agent execution runtime built on Vercel AI SDK v6
- Location: `apps/desktop/src/main/ai/`
- Contains: Session runner, build/spec orchestrators, provider factory, tools, security, config, memory, MCP client
- Depends on: `ai` (Vercel AI SDK), `@ai-sdk/*` provider packages, `@ai-sdk/mcp`
- Used by: Main process agent manager, worker threads

**Shared Layer:**
- Purpose: Types, constants, utilities and i18n shared between Main and Renderer without process coupling
- Location: `apps/desktop/src/shared/`
- Contains: TypeScript type definitions (19+ files), i18n locale JSON, constants, state machines, utilities
- Depends on: Nothing (pure TypeScript/JavaScript)
- Used by: Both Main and Renderer

## Data Flow

**Task Execution Flow (happy path):**

1. User creates a task in the Renderer kanban board → `window.electronAPI` IPC call to Main
2. `AgentManager` (`src/main/agent/agent-manager.ts`) receives the request, resolves auth via `src/main/ai/auth/resolver.ts`
3. `AgentProcessManager` (`src/main/agent/agent-process.ts`) creates a `WorkerBridge` and spawns a `worker_thread` running `src/main/ai/agent/worker.ts`
4. Worker instantiates `BuildOrchestrator` (`src/main/ai/orchestration/build-orchestrator.ts`) which drives phases: `planning → coding → qa_review → qa_fixing → complete`
5. Each phase calls `runAgentSession()` (`src/main/ai/session/runner.ts`) which uses `streamText()` from `ai` with tool execution loops
6. Tools (Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch) execute in the worker and return results to the stream
7. Phase progress events are posted via `parentPort.postMessage()` → `WorkerBridge` relays to `AgentManagerEvents` → IPC to Renderer
8. Renderer `useIpc` hook (`src/renderer/hooks/useIpc.ts`) batches updates into Zustand task store with 16ms frame coalescence

**Spec Creation Flow:**
1. User submits goal → `SpecOrchestrator` (`src/main/ai/orchestration/spec-orchestrator.ts`) runs complexity assessment first
2. Complexity tier (SIMPLE/STANDARD/COMPLEX) gates which pipeline phases run
3. Phases: `complexity_assessment → [discovery → requirements →] spec_writing → [research → critique →] planning → validation`
4. Each phase output is captured and injected into the next phase's kickoff message (context accumulation)

**IPC Communication Flow:**
1. Renderer calls `window.electronAPI.someMethod()` (defined in `src/preload/api/modules/`)
2. Preload module uses `ipcRenderer.invoke()` or `ipcRenderer.on()` to bridge to Main
3. Main `ipc-handlers/` module registered via `setupIpcHandlers()` (`src/main/ipc-setup.ts`) handles the call
4. Handler interacts with services/stores and returns result

**State Management:**
- Renderer state: Zustand stores in `src/renderer/stores/` (20+ stores, one per domain)
- Task lifecycle: XState machine (`src/shared/state-machines/task-machine.ts`) governs valid state transitions
- Main process state: Singleton managers (`AgentManager`, `TerminalManager`, `projectStore`, `terminalSessionStore`)
- Persistence: JSON files in `.auto-claude/specs/` (gitignored project data)

## Key Abstractions

**BuildOrchestrator:**
- Purpose: Drives the full build lifecycle through phase progression with retry/recovery logic
- Examples: `apps/desktop/src/main/ai/orchestration/build-orchestrator.ts`
- Pattern: EventEmitter subclass; emits phase events; delegates subtask iteration to `SubtaskIterator`

**runAgentSession():**
- Purpose: Core agent session runtime — wraps `streamText()` with auth refresh, cancellation, progress tracking, and context window management
- Examples: `apps/desktop/src/main/ai/session/runner.ts`
- Pattern: Returns `SessionResult` with outcome, usage, messages; handles 401 reactive refresh

**createProvider():**
- Purpose: Factory that maps provider name + config to a Vercel AI SDK `LanguageModel` instance
- Examples: `apps/desktop/src/main/ai/providers/factory.ts`
- Pattern: Switch on `SupportedProvider` enum; detects OAuth vs API key for Anthropic; supports 10+ providers

**Tool Registry:**
- Purpose: Per-agent-type tool set resolution — controls which tools each agent phase can use
- Examples: `apps/desktop/src/main/ai/tools/registry.ts`, `apps/desktop/src/main/ai/tools/build-registry.ts`
- Pattern: `AGENT_CONFIGS` registry maps `AgentType` → allowed tool names; security enforced at execution

**AgentManager:**
- Purpose: Facade orchestrating agent process lifecycle, auth resolution, worktree creation, and event routing
- Examples: `apps/desktop/src/main/agent/agent-manager.ts`
- Pattern: Slim facade delegating to `AgentProcessManager`, `AgentQueueManager`, `AgentState`, `AgentEvents`

**WorkerBridge:**
- Purpose: Relays `postMessage()` events from worker threads to the existing `AgentManagerEvents` interface
- Examples: `apps/desktop/src/main/ai/agent/worker-bridge.ts`
- Pattern: Bidirectional; sends config to worker via `workerData`, receives structured events back

**XState Task Machine:**
- Purpose: Defines valid task state transitions (backlog → planning → coding → qa_review → complete/failed)
- Examples: `apps/desktop/src/shared/state-machines/task-machine.ts`
- Pattern: Shared between Main and Renderer; single source of truth for state graph

## Entry Points

**Electron Main Process:**
- Location: `apps/desktop/src/main/index.ts`
- Triggers: Electron `app.whenReady()` → creates `BrowserWindow`, calls `setupIpcHandlers()`, initializes `AgentManager`, `TerminalManager`, `ClaudeProfileManager`
- Responsibilities: App lifecycle, window management, IPC setup, service initialization, Sentry error tracking

**Agent Worker Thread:**
- Location: `apps/desktop/src/main/ai/agent/worker.ts`
- Triggers: Spawned by `WorkerBridge` via `worker_threads.Worker`; receives `workerData` config
- Responsibilities: Instantiates orchestrator (BuildOrchestrator/SpecOrchestrator/QALoop), runs agent sessions, posts events back to main thread

**React App Root:**
- Location: `apps/desktop/src/renderer/App.tsx`
- Triggers: Vite-bundled renderer process loads in BrowserWindow
- Responsibilities: Renders all views (kanban, terminals, settings, GitHub/GitLab, roadmap, ideation, insights, changelog), initializes all Zustand stores, registers IPC listeners

**IPC Setup:**
- Location: `apps/desktop/src/main/ipc-setup.ts`
- Triggers: Called once from `main/index.ts` after window creation
- Responsibilities: Registers all 40+ domain-specific IPC handler modules organized by feature area

## Error Handling

**Strategy:** Layered — classify at source, surface to renderer via IPC events, display in UI

**Patterns:**
- Session errors are classified by `error-classifier.ts` (`src/main/ai/session/error-classifier.ts`) into 401/429/400/unknown categories
- 401 triggers reactive OAuth token refresh with single retry before surfacing auth failure modal in renderer
- 429 triggers rate limit detection → pauses build → emits `rate_limit_paused` phase event → renderer shows `RateLimitModal`
- Agent crashes post `PROCESS_EXITED` event; task machine transitions to `failed` state
- Production errors go to Sentry (`src/main/sentry.ts`) — `console.log` is not used in production code
- `ErrorBoundary` component (`src/renderer/components/ui/error-boundary.tsx`) catches renderer-side React errors

## Cross-Cutting Concerns

**Logging:** Sentry for production errors (`src/main/sentry.ts`); `debugLog`/`debugError` utilities (`src/shared/utils/debug-logger.ts`) for development-only output; `TaskLogWriter` for per-task log files

**Validation:** Zod schemas in `src/main/ai/schema/` validate LLM JSON outputs; `zod/v3` used in tool definitions; strict TypeScript mode enforced project-wide

**Authentication:** Multi-stage resolver (`src/main/ai/auth/resolver.ts`) with fallback chain: OAuth keychain → API key from settings → environment variable. `ClaudeProfileManager` manages multi-account credential lifecycle including auto-swap on rate limit

**Platform Abstraction:** `src/main/platform/` provides `isWindows()`, `isMacOS()`, `isLinux()`, `findExecutable()`, `getPathDelimiter()` — never use `process.platform` directly in non-platform files

**i18n:** All renderer user-facing strings use `react-i18next` keys from `src/shared/i18n/locales/{en,fr}/*.json` — hardcoded JSX strings are forbidden

**Security:** Bash tool uses allowlist/denylist validator (`src/main/ai/security/bash-validator.ts`); path containment enforced at tool execution; agent type controls which tools are accessible

---

*Architecture analysis: 2026-04-21*
