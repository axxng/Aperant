# Aperant Web Platform — Feature Spec

> **Purpose:** Complete reference for everything built in the web version of the Aperant desktop app. Use this to review features, find code, and plan future work.

## Overview

Aperant Web is a multi-product backlog platform that brings the desktop Electron app's product management features to the browser. Multiple team members manage tasks across GitHub/GitLab repositories through a shared web interface. The server (Express + SQLite) replaces Electron IPC, and a React SPA replaces the Electron renderer.

**Architecture:**
```
React SPA (Vite) → REST + SSE → Express API Server → SQLite + GitHub/GitLab API
                                       ↓
                              Vercel AI SDK v6 → Anthropic API
```

**Tech Stack:**

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript (strict), Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit, react-router-dom, react-i18next |
| Backend | Express 5, TypeScript, better-sqlite3, Zod, uuid, express-rate-limit |
| AI | Vercel AI SDK v6 (`ai` ^4.3), `@ai-sdk/anthropic` (^1.2) |
| Testing | Vitest, Biome (linting) |
| i18n | i18next + react-i18next, 12 namespaces, English + French |

---

## Application Structure

### Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ConsolidatedView` | All tasks across all products in a unified Kanban board |
| `/products/:productId` | `ProductView` | Single product's tasks in a Kanban board |
| `/products/:productId/settings` | `ProductSettings` | Product configuration (name, color, GitHub repo) |
| `/products/:productId/issues` | `GitHubIssuesList` | GitHub issues with split-pane detail view |
| `/products/:productId/prs` | `GitHubPRList` | GitHub PRs with AI-powered review |
| `/products/:productId/roadmap` | `Roadmap` | AI-generated strategic roadmap |
| `/products/:productId/ideation` | `Ideation` | AI-powered idea discovery |
| `/products/:productId/changelog` | `Changelog` | AI-generated release notes |
| `/products/:productId/gitlab-issues` | `GitLabIssuesList` | GitLab issues with split-pane detail |
| `/products/:productId/gitlab-mrs` | `GitLabMRList` | GitLab merge requests |
| `/insights` | `Insights` | AI chat interface (cross-product) |
| `/settings` | `Settings` | Global app settings |

### API Endpoints

| Prefix | Router | Auth | Rate Limit | Description |
|--------|--------|------|------------|-------------|
| `/api/auth` | `authRoutes` | Public | 20/15min | Register, login, user management |
| `/api/events` | `eventRoutes` | Public | — | SSE event stream |
| `/api/health` | inline | Public | — | Health check |
| `/api/products` | `productRoutes` | JWT | — | Product CRUD |
| `/api/tasks` | `taskRoutes` | JWT | — | Task CRUD + ordering |
| `/api/github` | `githubRoutes` | JWT | — | GitHub API proxy |
| `/api/ai` | `aiRoutes` | JWT | 15/min | AI session endpoints |
| `/api/investigate` | `investigationRoutes` | JWT | 15/min | Issue investigation (SSE) |
| `/api/pr-review` | `prReviewRoutes` | JWT | 15/min | PR AI review (SSE) |
| `/api/insights` | `insightsRoutes` | JWT | 15/min | Insights chat (SSE) |
| `/api/roadmap` | `roadmapRoutes` | JWT | 15/min | Roadmap CRUD + AI generation |
| `/api/ideation` | `ideationRoutes` | JWT | 15/min | Ideation CRUD + AI generation |
| `/api/changelog` | `changelogRoutes` | JWT | 15/min | Changelog CRUD + AI generation |
| `/api/settings` | `settingsRoutes` | JWT | — | App settings CRUD |
| `/api/gitlab` | `gitlabRoutes` | JWT | — | GitLab API proxy |

### Sidebar Navigation

- **All Products** → `/` (consolidated backlog)
- **Insights** → `/insights` (AI chat)
- **Per-product sub-nav** (visible when a product is selected):
  - Issues → `/products/:id/issues`
  - PRs → `/products/:id/prs`
  - Roadmap → `/products/:id/roadmap`
  - Ideation → `/products/:id/ideation`
  - Changelog → `/products/:id/changelog`
  - GitLab Issues → `/products/:id/gitlab-issues`
  - GitLab MRs → `/products/:id/gitlab-mrs`
- **Settings** → `/settings` (bottom)

### i18n Namespaces

`common`, `navigation`, `tasks`, `issues`, `prs`, `insights`, `roadmap`, `ideation`, `changelog`, `settings`, `gitlab`, `auth`

---

## Feature Details

### 1. Consolidated Backlog (All Products View)

The default landing page (`/`) shows a unified Kanban board with tasks from every product. Each task card displays a colored dot + product name badge so users can see which product a task belongs to.

**Dual-view mode** — The board header has a toggle between two modes:

- **Sort view** — Filter bar with text search, priority multi-select, category multi-select, and sort dropdown (newest/oldest/highest priority). Drag-and-drop changes task status only (moves between columns).
- **Priority view** — No filter bar. Tasks within each column can be manually reordered via drag-and-drop. The order is persisted to the database per scope (`consolidated` or a specific `productId`), so it survives page refreshes.

**4 Kanban columns:** Backlog → In Progress → Review → Done. Agent-specific statuses (queue, ai_review, pr_created, error) are mapped to the 4 visible columns.

Key files:
- `client/App.tsx` — `ConsolidatedView` (loads all tasks), `ProductView` (loads per-product)
- `client/components/KanbanBoard.tsx` — Board with dual-view toggle, column grouping, drag-and-drop
- `client/hooks/useKanbanFilters.ts` — Filter state + memoized filtering/sorting pipeline
- `client/components/KanbanFilterBar.tsx` — Search, priority, category, sort dropdowns
- `client/components/TaskCard.tsx` — Card with product badge, priority, category
- `client/components/SortableTaskCard.tsx` — dnd-kit sortable wrapper
- `client/stores/task-store.ts` — Task CRUD, `loadTaskOrder`/`reorderTasks` for persistence

### 2. Task Management

Full task lifecycle with CRUD, inline editing, and status management.

- **Create task** — Dialog with title, description, product selector, priority (4 levels), category (9 types)
- **Edit task** — Dialog with inline field editing, status change, priority/category toggles
- **Delete task** — Two-step confirmation in edit dialog
- **GitHub PR creation** — Create PR from task edit dialog (branch selection, title, body, draft option)
- **Drag-and-drop** — Move tasks between status columns, reorder within columns (priority view)

Key files:
- `server/routes/tasks.ts` — CRUD + status + ordering endpoints
- `server/db/tasks.ts` — SQLite operations
- `client/components/CreateTaskDialog.tsx`, `TaskEditDialog.tsx`, `CreatePRDialog.tsx`
- `shared/types/task.ts` — Task, TaskStatus, TaskPriority, TaskCategory types

### 3. GitHub Issues Integration

Split-pane layout: issue list (left 50%) + detail panel (right 50%).

- State filter (open/closed/all), text search, infinite scroll via IntersectionObserver
- Issue detail: metadata, labels, assignees, milestone, body
- **Import as Task** — Creates a task linked to the GitHub issue
- **AI Investigation** — Streams analysis of issue root cause, affected areas, proposed solution via SSE

Key files:
- `client/components/GitHubIssuesList.tsx` — Full split-pane UI + investigation panel
- `server/routes/github.ts` — GitHub API proxy (REST + GraphQL)
- `server/routes/investigation.ts` — AI investigation SSE endpoint
- `client/stores/github-issues-store.ts`, `investigation-store.ts`

### 4. GitHub PR Review

Split-pane layout mirroring issues. PR list with search, state filter, infinite scroll.

- PR detail: branch info (head → base), diff stats (additions/deletions), file list, labels
- **AI Review** — Streams code review analysis covering security, logic, performance, style via SSE
- Review panel with progress bar and streamed markdown output

Key files:
- `client/components/GitHubPRList.tsx` — Split-pane + AI review panel
- `server/routes/pr-review.ts` — AI review SSE with structured code review prompt
- `client/stores/pr-review-store.ts`
- `shared/types/pr.ts` — GitHubPR, PRFile types

### 5. Insights (AI Chat)

Multi-session chat interface for exploring codebases with AI tools.

- Session sidebar: create, rename, delete, select sessions
- Chat area: message bubbles (user/assistant), tool usage badges, streaming cursor
- AI agent has Read, Glob, Grep, WebFetch tools for codebase exploration
- Session persistence in SQLite (messages stored as JSON)
- Route: `/insights`

Key files:
- `client/components/Insights.tsx` — Full chat UI
- `server/routes/insights.ts` — REST + SSE chat endpoint
- `server/db/insights.ts` — Session CRUD
- `client/stores/insights-store.ts`

### 6. Roadmap & Strategic Planning

AI-powered roadmap generation with phase-based planning.

- **Three view modes:** Phases (timeline), Features (grid), Priority (MoSCoW grouping)
- AI generation from codebase analysis via SSE, outputs structured JSON
- Phase management (planned → in-progress → completed) with progress bars
- Feature detail panel with status, user stories, acceptance criteria editing
- SQLite storage (JSON phases/features in roadmaps table)
- Route: `/products/:productId/roadmap`

Key files:
- `client/components/Roadmap.tsx` — PhasesView, FeaturesGrid, PriorityView
- `server/routes/roadmap.ts` — CRUD + AI generation
- `server/db/roadmaps.ts` — DB operations
- `shared/types/roadmap.ts`

### 7. Ideation (AI Auto-Discovery)

AI-powered idea discovery across 6 categories.

- **Types:** code improvements, UI/UX, documentation, security, performance, code quality
- Type filter tabs with icons and counts, idea cards with multi-select
- Detail panel: rationale, severity, effort, affected files, implementation approach
- Actions: convert to task, dismiss, bulk delete
- Config panel: enable/disable types, max ideas per type
- Generation progress overlay with streaming text
- Route: `/products/:productId/ideation`

Key files:
- `client/components/Ideation.tsx` — TypeTabs, IdeaCard, IdeaDetailPanel, ConfigPanel
- `server/routes/ideation.ts` — CRUD + AI generation with `parseIdeasFromText`
- `client/stores/ideation-store.ts`
- `shared/types/ideation.ts`

### 8. Changelog Generation

AI-powered changelog with configurable format, audience, and source mode.

- **Source modes:** completed tasks, git history, branch diff
- **Formats:** Keep a Changelog, Simple List, GitHub Release
- **Audiences:** technical, user-facing, marketing
- Two-column layout: config sidebar + preview panel (edit/preview toggle)
- Copy to clipboard, save, delete, previous entry history
- Custom AI instructions textarea
- Route: `/products/:productId/changelog`

Key files:
- `client/components/Changelog.tsx` — ConfigPanel, PreviewPanel, GenerationOverlay
- `server/routes/changelog.ts` — CRUD + AI generation
- `client/stores/changelog-store.ts`
- `shared/types/changelog.ts`

### 9. Settings & Configuration

Global app settings with immediate persistence.

- **Appearance:** Light/Dark/System mode, 7 color themes (Default, Ocean, Forest, Dusk, Lime, Retro, Neo)
- **Language:** English / Français toggle
- **AI Model:** Opus, Sonnet, Haiku selector
- **API Keys:** Anthropic API key + GitHub token (show/hide toggle, masked in API responses)
- **Sync:** Interval configuration (10-3600 seconds)
- Server-side key-value store with whitelist validation
- Route: `/settings`

Key files:
- `client/components/Settings.tsx` — Full settings UI
- `server/routes/settings.ts` — CRUD with key whitelist, sensitive value masking
- `client/stores/settings-store.ts`

### 10. GitLab Integration

GitLab API proxy with split-pane issue and MR views.

- PRIVATE-TOKEN authentication (reads from settings DB)
- Self-hosted instance URL support (HTTPS required)
- **Issues:** state filter, search, pagination, detail with import-to-task
- **Merge Requests:** state filter (opened/closed/merged/all), branch info, merge status
- Connection check and project listing endpoints
- Routes: `/products/:productId/gitlab-issues`, `/products/:productId/gitlab-mrs`

Key files:
- `client/components/GitLabIssuesList.tsx`, `GitLabMRList.tsx`
- `server/routes/gitlab.ts` — API proxy with data mapping
- `client/stores/gitlab-store.ts`
- `shared/types/gitlab.ts`

### 11. Real-Time Sync & Notifications

SSE-based event stream with auto-reconnect and toast notifications.

- EventSource hook with exponential backoff (1s → 30s max)
- Events: sync_complete, sync_error, sync_started, task_created/updated/deleted, product_updated
- Auto-refresh: task and product stores update on relevant events
- Toast system: success/error/info/warning with auto-dismiss (5s), colored icons, dismiss buttons
- GitHub sync scheduler runs every 60s when GITHUB_TOKEN is set

Key files:
- `client/hooks/useEventStream.ts` — SSE with reconnect
- `client/hooks/useToast.ts` — Zustand toast store
- `client/hooks/useSyncEvents.ts` — Event → store bridge + toast triggers
- `client/components/ToastContainer.tsx`
- `server/sync/scheduler.ts`, `server/sync/github-sync.ts`

### 12. Multi-User Authentication

JWT-based auth with role-based access control.

- **Register** — email, name, password (min 8 chars). First user auto-promoted to admin
- **Login** — Returns JWT (HMAC-SHA256, 7-day expiry)
- **Roles:** admin, member, viewer
- **Admin endpoints:** List users, update role, delete user (cannot self-delete)
- Password hashing: scrypt with random salt
- Auth store persisted in localStorage via Zustand persist middleware
- Client auto-attaches `Authorization: Bearer <token>` to all API requests

Key files:
- `server/auth/jwt.ts` — Token creation/verification, password hashing
- `server/routes/auth.ts` — Register, login, me, user management
- `server/middleware/auth.ts` — `requireAuth` and `requireAdmin` middleware
- `server/db/users.ts` — User CRUD
- `client/stores/auth-store.ts`
- `client/lib/api-client.ts` — Auto-attaches JWT token

### AI Provider Infrastructure

Server-side AI layer powering features 3-8.

- **Provider factory** — Anthropic support with model shorthand resolution and thinking budgets
- **Session runner** — `runAgentSession()` wraps `streamText()` with SSE event callbacks
- **Builtin tools:** Read (with path traversal protection), Glob, Grep, WebFetch
- **Agent configs:** 7 types (insights, reviewer, investigator, roadmap, ideation, changelog, analyzer)
- **Express routes:** `POST /api/ai/session`, `GET /api/ai/agents`, `GET /api/ai/health`

Key files:
- `server/ai/providers/factory.ts` — Provider factory
- `server/ai/session/runner.ts` — streamText wrapper
- `server/ai/tools/index.ts` — Tool definitions
- `server/ai/config/agent-configs.ts` — Agent registry
- `server/routes/ai.ts` — Express routes

---

## Security Hardening

Applied across the entire server and client:

| Category | Implementation | Files |
|----------|---------------|-------|
| **JWT timing attacks** | `crypto.timingSafeEqual()` for signature and password hash comparison | `server/auth/jwt.ts` |
| **Auth middleware** | `requireAuth` applied to all protected routes (13 route groups) | `server/middleware/auth.ts`, `server/index.ts` |
| **Rate limiting** | Auth: 20 req/15min, AI endpoints: 15 req/min | `server/index.ts` (express-rate-limit) |
| **CORS** | Origin whitelist, Authorization header allowed | `server/index.ts` |
| **Path traversal** | `resolved.startsWith(cwd + sep)` in AI tools | `server/ai/tools/index.ts` |
| **SSRF protection** | GitLab instance URL must use HTTPS | `server/routes/gitlab.ts` |
| **Settings validation** | Key whitelist on GET/DELETE, fixed-length secret masking | `server/routes/settings.ts` |
| **Input validation** | Zod schemas on all mutating endpoints, numeric IID validation | `server/validation.ts`, `server/routes/gitlab.ts` |
| **Security headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Cache-Control | `server/index.ts` |
| **Client auth** | JWT auto-attached to all API requests from persisted store | `client/lib/api-client.ts` |

---

## Database Schema

SQLite with 6 migrations:

| Table | Migration | Description |
|-------|-----------|-------------|
| `products` | 000 | Product CRUD (id, name, color, github owner/repo) |
| `tasks` | 000 | Task management (id, productId, title, description, status, priority, category) |
| `task_order` | 000 | Persisted task ordering per scope + status |
| `sync_state` | 000 | GitHub sync state tracking |
| `settings` | 000 | Key-value app settings |
| `insights_sessions` | 002 | AI chat sessions with message history (JSON) |
| `roadmaps` | 003 | Roadmap data with phases/features (JSON) |
| `ideation_sessions` | 004 | AI-generated ideas per product (JSON) |
| `changelogs` | 005 | Generated changelog entries |
| `users` | 006 | User accounts (email, name, password_hash, role) |

---

## Conventions

- **i18n required** — All UI text uses `react-i18next`. Add keys to both `en/*.json` and `fr/*.json`.
- **Zod validation** — All API inputs validated server-side via Zod schemas.
- **Typed API client** — All endpoints in `client/lib/api-client.ts` with proper types.
- **SSE for streaming** — AI responses stream via SSE with `text-delta`, `progress`, `done` events.
- **Auth required** — All protected routes use `requireAuth` middleware. Auth routes are public.
- **Minimal changes** — Implement only what's specified. Don't add unrequested features.

---

## Desktop-Only Features (Not in Web)

These desktop Electron features are intentionally excluded from the web app because they require local system access:

| Feature | Reason |
|---------|--------|
| Agent Terminals (PTY) | Requires Electron PTY / local shell |
| Autonomous Agent Pipeline (planner → coder → QA) | Requires local filesystem + git worktrees |
| Git Worktree Management | Requires local git |
| Semantic Merge / Conflict Resolution | Requires local git |
| Graphiti Memory System | Requires Python MCP sidecar |
| File Explorer | Requires local filesystem |
| Screenshot Capture | Requires Electron screen API |
| Multi-Account Auto-Swap | Could be added in future |
| Linear Integration | Could be added in future |
| Competitor Analysis (Roadmap) | Could be added in future |
| Batch Issue Review / Autofix | Could be added in future |
