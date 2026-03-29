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
| **PR list, detail, files endpoints** | Done | `server/routes/github.ts`, `shared/types/pr.ts` |
| **PR AI review (SSE streaming)** | Done | `server/routes/pr-review.ts` |

### UI Components (continued)
| Component | Status | Files |
|-----------|--------|-------|
| **GitHub PR list (split-pane + AI review)** | Done | `client/components/GitHubPRList.tsx`, `client/stores/pr-review-store.ts` |
| **PR sidebar sub-nav** | Done | `client/components/Sidebar.tsx` |
| **PR i18n (en + fr)** | Done | `shared/i18n/locales/{en,fr}/prs.json` |
| **Insights chat (multi-session, streaming)** | Done | `client/components/Insights.tsx`, `client/stores/insights-store.ts` |
| **Insights sidebar nav** | Done | `client/components/Sidebar.tsx` |
| **Insights sessions DB + routes** | Done | `server/db/insights.ts`, `server/routes/insights.ts` |
| **Insights i18n (en + fr)** | Done | `shared/i18n/locales/{en,fr}/insights.json` |
| **Roadmap UI (phases, features, priorities)** | Done | `client/components/Roadmap.tsx`, `client/stores/roadmap-store.ts` |
| **Roadmap sidebar sub-nav** | Done | `client/components/Sidebar.tsx` |
| **Roadmap DB + routes (CRUD, AI generation)** | Done | `server/db/roadmaps.ts`, `server/routes/roadmap.ts` |
| **Roadmap i18n (en + fr)** | Done | `shared/i18n/locales/{en,fr}/roadmap.json` |
| **Roadmap types** | Done | `shared/types/roadmap.ts` |
| **Ideation UI (type tabs, cards, detail panel)** | Done | `client/components/Ideation.tsx`, `client/stores/ideation-store.ts` |
| **Ideation sidebar sub-nav** | Done | `client/components/Sidebar.tsx` |
| **Ideation DB + routes (CRUD, AI generation)** | Done | `server/db/ideation.ts`, `server/routes/ideation.ts` |
| **Ideation i18n (en + fr)** | Done | `shared/i18n/locales/{en,fr}/ideation.json` |
| **Ideation types** | Done | `shared/types/ideation.ts` |

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

### ~~3. GitHub PR Review (AI-Powered)~~ (DONE)

Completed. PR list with split-pane detail view and AI-powered review. Includes:
- PR list page with search, state filter (open/closed/all), infinite scroll
- PR detail view with branch info, diff stats, file list, labels
- AI review button triggers streaming analysis via SSE
- Review panel with progress bar, streamed markdown output, error/complete states
- Sidebar sub-nav link for PRs under active product
- Route: `/products/:productId/prs`

Key files:
- `shared/types/pr.ts` — GitHubPR, PRFile, PRReviewFinding, PRReviewResult types
- `server/routes/github.ts` — PR list, detail, files endpoints
- `server/routes/pr-review.ts` — AI review route with SSE streaming
- `client/components/GitHubPRList.tsx` — Split-pane PR list + detail + review
- `client/stores/pr-review-store.ts` — Zustand store for PR list and review state
- `shared/i18n/locales/{en,fr}/prs.json` — i18n translations

---

### ~~4. Insights (AI Chat Interface)~~ (DONE)

Completed. Multi-session AI chat for exploring codebases with streaming responses. Includes:
- Two-pane layout: session sidebar (create, rename, delete) + chat area
- Message bubbles with user/assistant roles, tool usage badges
- Streaming text with cursor animation, tool indicator during execution
- Session persistence in SQLite (insights_sessions table)
- Auto-title from first message, full message history per session
- Route: `/insights`, sidebar nav link with Lightbulb icon

Key files:
- `server/db/insights.ts` — DB access (CRUD for sessions)
- `server/db/schema.ts` — Migration 002 for insights_sessions table
- `server/routes/insights.ts` — REST + SSE routes (list, create, get, update, delete, chat)
- `client/components/Insights.tsx` — Full chat UI with streaming
- `client/stores/insights-store.ts` — Zustand store for sessions and streaming state
- `shared/i18n/locales/{en,fr}/insights.json` — i18n translations

---

### ~~5. Roadmap & Strategic Planning~~ (DONE)

Completed. AI-powered roadmap generation with phase-based planning and feature management. Includes:
- Three view modes: Phases (timeline), Features (grid), Priority (grouped)
- AI-generated roadmap from codebase analysis via SSE streaming
- Feature cards with priority (critical/high/medium/low), status, category, milestones
- Phase management (planned → in-progress → completed) with progress tracking
- Feature detail panel with full metadata editing
- SQLite storage (roadmaps table with JSON phases/features)
- Sidebar sub-nav link with Map icon
- Route: `/products/:productId/roadmap`

Key files:
- `shared/types/roadmap.ts` — Roadmap, RoadmapPhase, RoadmapFeature, RoadmapMilestone types
- `server/db/schema.ts` — Migration 003 for roadmaps table
- `server/db/roadmaps.ts` — DB access (CRUD for roadmaps)
- `server/routes/roadmap.ts` — REST + SSE routes (get, update, delete, generate)
- `client/components/Roadmap.tsx` — Full roadmap UI with PhasesView, FeaturesGrid, PriorityView
- `client/stores/roadmap-store.ts` — Zustand store for roadmap and generation state
- `shared/i18n/locales/{en,fr}/roadmap.json` — i18n translations

---

### ~~6. Ideation (AI Auto-Discovery)~~ (DONE)

Completed. AI-powered idea discovery across 6 categories with streaming generation. Includes:
- Six discovery types: code improvements, UI/UX, documentation, security, performance, code quality
- AI-generated ideas via SSE streaming with progress tracking
- Type filter tabs with colored badges and Lucide icons
- Idea cards with type/status badges, multi-select, dismiss/delete actions
- Detail panel with rationale, category, severity, affected files, implementation approach
- Convert idea to task, dismiss all, bulk delete
- Config panel for enabling/disabling types and max ideas per type
- Generation progress screen with streaming text and phase indicators
- SQLite storage (ideation_sessions table)
- Sidebar sub-nav link with Zap icon
- Route: `/products/:productId/ideation`

Key files:
- `shared/types/ideation.ts` — IdeationType, Idea, IdeationSession, IdeationConfig types
- `server/db/schema.ts` — Migration 004 for ideation_sessions table
- `server/db/ideation.ts` — DB access (CRUD for sessions)
- `server/routes/ideation.ts` — REST + SSE routes (get, update, delete, generate)
- `client/components/Ideation.tsx` — Full ideation UI with TypeTabs, IdeaCard, IdeaDetailPanel
- `client/stores/ideation-store.ts` — Zustand store with filtering, selection, generation state
- `shared/i18n/locales/{en,fr}/ideation.json` — i18n translations

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
