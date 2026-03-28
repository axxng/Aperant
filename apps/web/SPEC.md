# Aperant Web Platform — Feature Spec

> **Purpose:** This spec documents what has been built and what remains for the web version of the Aperant desktop app. It's designed so multiple agents can work on different features in parallel.

## Overview

Aperant Web is a multi-product backlog platform that brings the desktop Electron app's features to the browser. Multiple team members manage tasks across GitHub repositories and projects through a shared web interface. The server (Express + SQLite) replaces Electron IPC, and a React SPA replaces the Electron renderer.

**Architecture:**
```
React SPA (Vite) → REST + SSE → Express API Server → SQLite + GitHub API
```

---

## Completed Features

### Server Infrastructure
| Component | Status | Files |
|-----------|--------|-------|
| Express server with CORS, graceful shutdown | Done | `server/index.ts` |
| SQLite schema (products, tasks, task_order, sync_state) | Done | `server/db/schema.ts` |
| Product CRUD | Done | `server/db/products.ts`, `server/routes/products.ts` |
| Task CRUD + ordering | Done | `server/db/tasks.ts`, `server/routes/tasks.ts` |
| GitHub issues API (list, comment, update) | Done | `server/routes/github.ts` |
| GitHub Projects v2 GraphQL (info, items) | Done | `server/routes/github.ts` |
| GitHub PR creation + branch listing | Done | `server/routes/github.ts` |
| SSE event stream with heartbeat | Done | `server/routes/events.ts` |
| GitHub sync engine (repos + Projects) | Done | `server/sync/github-sync.ts` |
| Sync scheduler (60s interval) | Done | `server/sync/scheduler.ts` |
| Zod validation for all inputs | Done | `server/validation.ts` |

### Client Infrastructure
| Component | Status | Files |
|-----------|--------|-------|
| Vite + React entry, Tailwind CSS v4 | Done | `client/main.tsx`, `client/styles/globals.css` |
| Utilities (`cn()`, `formatRelativeTime()`) | Done | `client/lib/utils.ts` |
| i18n setup (en + fr) | Done | `client/lib/i18n.ts`, `shared/i18n/locales/` |
| Typed API client | Done | `client/lib/api-client.ts` |
| Product store (Zustand) | Done | `client/stores/product-store.ts` |
| Task store (Zustand) | Done | `client/stores/task-store.ts` |
| Kanban settings store | Done | `client/stores/kanban-settings-store.ts` |
| React Router app shell + sidebar | Done | `client/App.tsx`, `client/components/Sidebar.tsx` |

### UI Components
| Component | Status | Files |
|-----------|--------|-------|
| UI primitives (Button, Card, Dialog, Badge, Input, etc.) | Done | `client/components/ui/*` |
| KanbanBoard with drag-and-drop | Done | `client/components/KanbanBoard.tsx` |
| TaskCard with product badges | Done | `client/components/TaskCard.tsx` |
| SortableTaskCard (dnd-kit) | Done | `client/components/SortableTaskCard.tsx` |
| CreateProductDialog | Done | `client/components/CreateProductDialog.tsx` |
| CreateTaskDialog | Done | `client/components/CreateTaskDialog.tsx` |
| ProductSettings | Done | `client/components/ProductSettings.tsx` |
| **Kanban filters & search** | Done | `client/hooks/useKanbanFilters.ts`, `client/components/KanbanFilterBar.tsx` |
| **Task edit dialog** | Done | `client/components/TaskEditDialog.tsx` |
| **GitHub PR creation dialog** | Done | `client/components/CreatePRDialog.tsx` |
| **GitHub issues list (split-pane)** | Done | `client/components/GitHubIssuesList.tsx`, `client/stores/github-issues-store.ts` |
| **Issues sidebar sub-nav** | Done | `client/components/Sidebar.tsx` (sub-nav under active product) |
| **Issues i18n (en + fr)** | Done | `shared/i18n/locales/{en,fr}/issues.json` |

### AI Infrastructure (Server)
| Component | Status | Files |
|-----------|--------|-------|
| AI provider factory (Anthropic, extensible) | Done | `server/ai/providers/factory.ts` |
| Session runner (streamText + SSE events) | Done | `server/ai/session/runner.ts`, `server/ai/session/types.ts` |
| Builtin tools (Read, Glob, Grep, WebFetch) | Done | `server/ai/tools/index.ts` |
| Agent config registry (7 agent types) | Done | `server/ai/config/agent-configs.ts` |
| AI routes (session, agents, health) | Done | `server/routes/ai.ts` |
| **Issue investigation (AI-powered SSE)** | Done | `server/routes/investigation.ts`, `client/stores/investigation-store.ts` |

---

## Remaining Features

Features are grouped by domain. Each can be worked on independently.

### ~~1. GitHub Issues List & Import~~ (DONE)

Completed. Split-pane layout with issue list (left) and detail panel (right). Includes:
- State filtering (open/closed/all), text search, infinite scroll pagination
- Issue detail with metadata, labels, assignees, milestone
- Import-to-task action
- Sidebar sub-navigation under active product
- Route: `/products/:productId/issues`

Key files: `client/components/GitHubIssuesList.tsx`, `client/stores/github-issues-store.ts`

### ~~1b. GitHub Issues — Remaining Enhancements~~ (Optional)
- Bulk import (select multiple issues)
- Markdown rendering for issue body (currently plain text)
- Label/assignee filtering dropdowns (currently only text search + state filter)

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/github-issues/GitHubIssueList.tsx`
- `apps/desktop/src/renderer/stores/github/issues-store.ts`

---

### ~~2. GitHub Issue Investigation (AI-Powered)~~ (DONE)

Completed. AI-powered issue investigation with streaming SSE results. Includes:
- "Investigate" button on issue detail panel, alongside "Import as Task"
- Server route (`POST /api/investigate`) runs AI agent session with investigator config
- SSE streaming of progress events and text deltas to the client
- Investigation panel with progress bar, streamed markdown output, error/complete states
- Zustand store for investigation state management
- i18n keys (en + fr) for all investigation UI text

Key files:
- `server/routes/investigation.ts` — Express route with SSE streaming AI session
- `client/stores/investigation-store.ts` — Zustand store (status, streamedText, result)
- `client/components/GitHubIssuesList.tsx` — Updated IssueDetail with investigate button + panel
- `client/lib/api-client.ts` — `api.investigate.startInvestigation()` method

---

### 3. GitHub PR Review (AI-Powered)
**Desktop equivalent:** `components/github-prs/`, `stores/github/pr-review-store.ts`

**What to build:**
- PR list page with filtering (status, author, label, sort)
- PR detail view with commit diffs
- AI-powered review pipeline with specialist agents:
  - Logic specialist — correctness and logic flaws
  - Quality specialist — code quality issues
  - Security specialist — vulnerability detection
  - Codebase fit specialist — architectural alignment
- Findings tree grouped by severity
- Bulk PR review operations

**Server work needed:**
- New routes: `GET /api/github/repos/:owner/:repo/pulls`, `GET .../pulls/:number`
- New route: `POST /api/products/:id/github/prs/:number/review` (SSE stream)
- PR review orchestration (parallel specialist agents)

**Client work:**
- New route: `/products/:id/prs`
- Components: `GitHubPRList.tsx`, `PRDetailView.tsx`, `PRFindingsTree.tsx`, `PRFilterBar.tsx`
- Store: `client/stores/pr-review-store.ts`
- i18n keys for PR review

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/github-prs/` — full PR review UI
- `apps/desktop/src/main/ai/config/agent-configs.ts` — PR review agent configs
- `apps/desktop/src/renderer/stores/github/pr-review-store.ts`

**Dependency:** Requires AI provider infrastructure (Feature 8)

---

### 4. Insights (AI Chat Interface)
**Desktop equivalent:** `components/Insights.tsx`, `stores/insights-store.ts`

**What to build:**
- Multi-session AI chat interface for exploring codebases
- Session management (create, switch, delete, rename)
- Per-session model configuration
- Markdown rendering in chat messages
- Streaming responses via SSE

**Server work needed:**
- New routes: `POST /api/insights/sessions`, `GET /api/insights/sessions`
- New route: `POST /api/insights/sessions/:id/messages` (SSE stream)
- Session persistence in SQLite (new table)
- AI agent session with codebase tools (Read, Glob, Grep)

**Client work:**
- New route: `/insights`
- Components: `Insights.tsx`, `InsightsSessionList.tsx`, `ChatMessage.tsx`
- Store: `client/stores/insights-store.ts`
- i18n namespace: `insights`

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/Insights.tsx`
- `apps/desktop/src/main/ai/runners/insights.ts`

**Dependency:** Requires AI provider infrastructure (Feature 8)

---

### 5. Roadmap & Strategic Planning
**Desktop equivalent:** `components/roadmap/`, `stores/roadmap-store.ts`

**What to build:**
- Vision statement and target audience definition per product
- Phase-based delivery timeline (planned → in-progress → completed)
- Feature cards with status, description, milestones
- AI-generated roadmap from codebase analysis
- Competitor analysis integration
- Feature-to-task conversion

**Server work needed:**
- New SQLite tables: `roadmaps`, `roadmap_phases`, `roadmap_features`
- CRUD routes for roadmap data
- AI route for roadmap generation (SSE)

**Client work:**
- New route: `/products/:id/roadmap`
- Components: `Roadmap.tsx`, `PhaseColumn.tsx`, `FeatureCard.tsx`, `CompetitorAnalysis.tsx`
- Store: `client/stores/roadmap-store.ts`
- i18n namespace: `roadmap`

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/roadmap/`
- `apps/desktop/src/main/ai/runners/roadmap.ts`
- `apps/desktop/src/renderer/stores/roadmap-store.ts`

**Dependency:** Requires AI provider infrastructure (Feature 8)

---

### 6. Ideation (AI Auto-Discovery)
**Desktop equivalent:** `components/ideation/`, `stores/ideation-store.ts`

**What to build:**
- Three discovery types: improvements, performance issues, security vulnerabilities
- AI-powered codebase scanning with streaming progress
- Idea cards with status (new, dismissed, archived)
- Idea detail panel with description and rationale
- Convert idea → task
- Bulk operations (dismiss all, delete multiple)
- Filtering and searching

**Server work needed:**
- New SQLite tables: `ideation_sessions`, `ideas`
- CRUD routes for ideation data
- AI route for idea generation (SSE, per type)

**Client work:**
- New route: `/products/:id/ideation`
- Components: `Ideation.tsx`, `IdeaCard.tsx`, `IdeaDetailPanel.tsx`, `IdeationFilters.tsx`
- Store: `client/stores/ideation-store.ts`
- i18n namespace: `ideation`

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/ideation/`
- `apps/desktop/src/main/ai/runners/ideation.ts`
- `apps/desktop/src/renderer/stores/ideation-store.ts`

**Dependency:** Requires AI provider infrastructure (Feature 8)

---

### 7. Changelog Generation
**Desktop equivalent:** `components/changelog/`, `stores/changelog-store.ts`

**What to build:**
- Three source modes: completed tasks, git history, branch diff
- AI-generated release notes with configurable tone and format
- Version suggestion from git tags
- Preview panel with markdown rendering
- GitHub release creation from changelog
- Save/export to file

**Server work needed:**
- Git operations: list tags, list commits between tags, branch diff
- AI route for changelog generation (SSE)
- GitHub release creation route

**Client work:**
- New route: `/products/:id/changelog`
- Components: `Changelog.tsx`, `SourceSelector.tsx`, `ChangelogPreview.tsx`, `ConfigPanel.tsx`
- Store: `client/stores/changelog-store.ts`
- i18n namespace: `changelog`

**Key patterns from desktop:**
- `apps/desktop/src/renderer/components/changelog/`
- `apps/desktop/src/main/ai/runners/changelog.ts`
- `apps/desktop/src/main/changelog/`

**Dependency:** Requires AI provider infrastructure (Feature 8)

---

### ~~8. AI Provider Infrastructure~~ (DONE)

Completed. Server-side AI infrastructure using Vercel AI SDK v6. Includes:
- Provider factory with Anthropic support, model shorthand resolution, thinking budget configs
- Session runner wrapping `streamText()` with SSE event streaming
- Builtin tools: Read, Glob, Grep, WebFetch (with path traversal protection)
- Agent config registry (7 agent types: insights, reviewer, investigator, roadmap, ideation, changelog, analyzer)
- Express routes: `POST /api/ai/session` (SSE stream), `GET /api/ai/agents`, `GET /api/ai/health`

Key files:
- `server/ai/providers/factory.ts` — Provider factory, model resolution, thinking options
- `server/ai/session/runner.ts` — `runAgentSession()` with streamText + event callbacks
- `server/ai/session/types.ts` — SessionResult, StreamEvent types
- `server/ai/tools/index.ts` — Builtin tool definitions (Read, Glob, Grep, WebFetch)
- `server/ai/config/agent-configs.ts` — Agent type registry with tool groupings
- `server/ai/index.ts` — Barrel export
- `server/routes/ai.ts` — Express routes with SSE streaming

**This is a foundation for Features 2, 3, 4, 5, 6, 7 — all now unblocked.**

---

### 9. Settings & Configuration
**Desktop equivalent:** `components/settings/`, `stores/settings-store.ts`

**What to build:**
- Settings page accessible from sidebar
- Theme selection (7 themes × light/dark)
- AI provider configuration (API keys, default model)
- Sync interval configuration
- GitHub token management
- Product-level settings (repos, sync, status mapping)

**Client work:**
- New route: `/settings`
- Components: `SettingsPage.tsx`, `ThemeSelector.tsx`, `AIProviderConfig.tsx`
- Store: `client/stores/settings-store.ts`
- Settings persistence via server API (new `settings` table + routes)

---

### 10. GitLab Integration
**Desktop equivalent:** `main/ipc-handlers/gitlab-handlers.ts`, `stores/gitlab-store.ts`

**What to build:**
- GitLab project connection (personal access token)
- Issue listing and sync
- Merge request listing
- Import GitLab issues as tasks
- Product source type: `gitlab_project`

**Server work needed:**
- New routes: `server/routes/gitlab.ts`
- GitLab API client (REST)
- Sync support for GitLab projects

**Client work:**
- GitLab issues list page
- Merge request list page
- GitLab settings in product configuration

---

### 11. Real-Time Sync & Notifications
**Desktop equivalent:** Agent events, SSE push

**What to build:**
- SSE client that reconnects on disconnect
- Real-time task updates when GitHub sync finds changes
- Toast notifications for sync results, errors
- Sync status indicator in sidebar (per product)
- Manual sync trigger button

**Client work:**
- SSE subscription hook: `client/hooks/useEventStream.ts`
- Toast notification system
- Sync status store integration
- Auto-refresh task list on sync events

---

### 12. Multi-User Authentication
**Not in desktop — new for web**

**What to build:**
- User authentication (JWT or session-based)
- User accounts with roles
- Per-user GitHub token storage
- Activity log (who changed what)
- Team management

**This is lower priority and can be deferred.**

---

## Feature Dependency Graph

```
Feature 8 (AI Provider Infrastructure)
  ├── Feature 2 (Issue Investigation)
  ├── Feature 3 (PR Review)
  ├── Feature 4 (Insights)
  ├── Feature 5 (Roadmap)
  ├── Feature 6 (Ideation)
  └── Feature 7 (Changelog)

No dependencies (can start immediately):
  ├── Feature 1 (GitHub Issues List)
  ├── Feature 9 (Settings)
  ├── Feature 10 (GitLab Integration)
  └── Feature 11 (Real-Time Sync)

Feature 12 (Multi-User Auth) — standalone, lower priority
```

## Parallel Work Guide

Agents can work on these simultaneously without conflicts:

| Agent | Feature | Key files (no overlap) |
|-------|---------|----------------------|
| Agent A | Feature 8 (AI infra) | `server/ai/**` |
| Agent B | Feature 1 (Issues list) | `client/components/github-issues/**`, `stores/github-issues-store.ts` |
| Agent C | Feature 9 (Settings) | `client/components/settings/**`, `stores/settings-store.ts`, `server/routes/settings.ts` |
| Agent D | Feature 11 (Real-time sync) | `client/hooks/useEventStream.ts`, toast system |
| Agent E | Feature 10 (GitLab) | `server/routes/gitlab.ts`, `client/components/gitlab/**` |

After Feature 8 is done, AI-dependent features can be parallelized:

| Agent | Feature | Key files |
|-------|---------|-----------|
| Agent F | Feature 2 (Investigation) | `server/routes/ai-investigation.ts`, investigation UI |
| Agent G | Feature 3 (PR Review) | `server/routes/ai-pr-review.ts`, PR review UI |
| Agent H | Feature 4 (Insights) | `server/routes/ai-insights.ts`, insights UI |
| Agent I | Feature 5 (Roadmap) | `server/routes/ai-roadmap.ts`, roadmap UI |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript (strict), Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit, react-router, react-i18next |
| Backend | Express, TypeScript, better-sqlite3, Zod, node-cron |
| AI | Vercel AI SDK v6 (`ai` package), `@ai-sdk/anthropic`, `@ai-sdk/openai` |
| Testing | Vitest, Biome (linting) |

## Conventions

- **i18n required** — All UI text uses `react-i18next`. Add keys to both `en/*.json` and `fr/*.json`.
- **Zod validation** — All API inputs validated server-side via Zod schemas in `validation.ts`.
- **Typed API client** — All new endpoints must be added to `client/lib/api-client.ts` with proper types.
- **SSE for streaming** — AI responses stream via SSE (`server/routes/events.ts` pattern).
- **No `console.log`** — Use proper error handling; `console.error` for actual errors only.
- **Minimal changes** — Implement only what's specified. Don't add unrequested features.
