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
| `/api/auth` | `authRoutes` | Public | 20/15min | OTP login, user management (admin) |
| `/api/events` | `eventRoutes` | JWT (query param) | — | SSE event stream |
| `/api/health` | inline | Public | — | Health check |
| `/api/products` | `productRoutes` | JWT + admin | — | Product CRUD |
| `/api/tasks` | `taskRoutes` | JWT + member | — | Task CRUD + ordering |
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
- **API Keys:** Anthropic API key + GitHub token (show/hide toggle, masked in API responses). Keys saved in settings DB are used by server routes with env var fallback via `config-resolver.ts`.
- **Sync:** Interval configuration (10-3600 seconds, sent as string to match bulk settings schema)
- Server-side key-value store with whitelist validation
- Route: `/settings`

Key files:
- `client/components/Settings.tsx` — Full settings UI (uses `authenticatedFetch`)
- `server/routes/settings.ts` — CRUD with key whitelist, sensitive value masking
- `server/config-resolver.ts` — Resolves config from DB settings then env var fallback
- `client/stores/settings-store.ts`

### 10. GitLab Integration

GitLab API proxy with split-pane issue and MR views.

- PRIVATE-TOKEN authentication (reads from settings DB)
- Self-hosted instance URL support (HTTPS required)
- **Product source type:** `gitlab_project` with `path` field (e.g. `"group/project"`) in product sources array, validated by `gitlabProjectSourceSchema`
- **Issues:** state filter, search, pagination, detail with import-to-task (labels include default color, metadata uses `sourceType: 'gitlab'`)
- **Merge Requests:** state filter (opened/closed/merged/all), branch info, merge status
- Connection check and project listing endpoints
- Routes: `/products/:productId/gitlab-issues`, `/products/:productId/gitlab-mrs`

Key files:
- `client/components/GitLabIssuesList.tsx`, `GitLabMRList.tsx` — Use `authenticatedFetch`
- `server/routes/gitlab.ts` — API proxy with data mapping
- `client/stores/gitlab-store.ts`
- `shared/types/gitlab.ts`, `shared/types/product.ts` — `GitLabProjectSource` type

### 11. Real-Time Sync & Notifications

SSE-based event stream with auto-reconnect and toast notifications.

- EventSource hook with exponential backoff (1s → 30s max), JWT token passed via `?token=` query param
- Events: sync_complete, sync_error, sync_started, task_created, task_updated, task_deleted, tasks_reordered, product_updated
- Task mutations (create, update, status change, delete, reorder) broadcast SSE events for real-time multi-tab/multi-user sync
- Auto-refresh: task and product stores update on relevant events
- Toast system: success/error/info/warning with auto-dismiss (5s), colored icons, dismiss buttons
- GitHub sync scheduler runs every 60s when GitHub token is available (settings DB or `GITHUB_TOKEN` env var)

Key files:
- `client/hooks/useEventStream.ts` — SSE with reconnect
- `client/hooks/useToast.ts` — Zustand toast store
- `client/hooks/useSyncEvents.ts` — Event → store bridge + toast triggers
- `client/components/ToastContainer.tsx`
- `server/sync/scheduler.ts`, `server/sync/github-sync.ts`

### 12. Multi-User Authentication

Whitelist-only email OTP authentication with role-based access control.

- **No self-registration** — Admin whitelists email addresses via a user management panel in Settings
- **Bootstrap** — `ADMIN_EMAIL` env var seeds the first admin on startup when zero users exist
- **OTP login** — User enters whitelisted email → receives 6-digit OTP via Resend → enters code → receives JWT (7-day expiry). Non-whitelisted emails get the same "check your email" response (no information leak)
- **Rate limiting** — Max 5 OTP requests per email per 15 minutes
- **Roles:** admin, member, viewer
- **Role enforcement** — `requireRole(...roles)` middleware applied to all route groups:
  - `requireRole('admin')`: settings, user management, product CRUD, sync triggers, GitLab config
  - `requireRole('admin', 'member')`: task mutations, AI features (insights, roadmap, ideation, changelog, investigate, pr-review)
  - `requireAuth` only (any role): all GET/read endpoints, SSE events
- **Admin panel** — List users with roles, add whitelisted email + role, change role, remove user
- **Resend integration** — `RESEND_API_KEY` + `OTP_FROM_EMAIL` env vars. Falls back to console.log in development
- Auth store persisted in localStorage via Zustand persist middleware
- Client auto-attaches JWT to all API requests via `authenticatedFetch()` (SSE uses `?token=` query param)

Key files:
- `server/auth/jwt.ts` — Token creation/verification, startup warning
- `server/auth/otp.ts` — OTP generation, storage, verification (5-minute expiry)
- `server/auth/email.ts` — Resend email delivery with dev fallback
- `server/routes/auth.ts` — Request OTP, verify OTP, me, user management (admin)
- `server/middleware/auth.ts` — `requireAuth`, `requireRole(...roles)`, `requireAdmin`
- `server/db/users.ts` — User CRUD (password_hash nullable for OTP-only auth)
- `client/components/LoginPage.tsx` — Two-step OTP login form
- `client/stores/auth-store.ts` — `requestOtp()`, `verifyOtp()`, `checkSession()`
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
| **JWT timing attacks** | `crypto.timingSafeEqual()` for signature comparison | `server/auth/jwt.ts` |
| **Auth middleware** | `requireAuth` + `requireRole()` applied to all routes; accepts Bearer header or `?token=` query param | `server/middleware/auth.ts`, `server/index.ts` |
| **OTP rate limiting** | Max 5 OTP requests per email per 15 minutes | `server/auth/otp.ts` |
| **Rate limiting** | Auth: 20 req/15min, AI endpoints: 15 req/min | `server/index.ts` (express-rate-limit) |
| **CORS** | Origin whitelist, Authorization header allowed | `server/index.ts` |
| **Path traversal** | `resolved.startsWith(cwd + sep)` in AI tools | `server/ai/tools/index.ts` |
| **SSRF protection** | GitLab instance URL must use HTTPS | `server/routes/gitlab.ts` |
| **Settings validation** | Key whitelist on GET/DELETE, fixed-length secret masking | `server/routes/settings.ts` |
| **Input validation** | Zod schemas on all mutating endpoints, numeric IID validation | `server/validation.ts`, `server/routes/gitlab.ts` |
| **Security headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Cache-Control | `server/index.ts` |
| **Client auth** | JWT auto-attached to all API requests via `authenticatedFetch()` and `request()` | `client/lib/api-client.ts` |
| **Config resolution** | API keys resolved from settings DB first, then env var fallback | `server/config-resolver.ts` |
| **SSE auth** | `/api/events` requires JWT via `?token=` query param (EventSource can't set headers) | `server/middleware/auth.ts`, `client/hooks/useEventStream.ts` |
| **JWT secret warning** | Logs warning on startup if `JWT_SECRET` is unset (random fallback invalidates tokens on restart) | `server/auth/jwt.ts` |

---

## Database Schema

SQLite with 8 migrations:

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
| `users` | 006 | User accounts (email, name, password_hash nullable, role) |
| `otp_codes` | 007 | OTP codes (email, code_hash, expires_at, used) |

---

## Setup & Installation

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
cd apps/web
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Required For | How to Get |
|----------|-------------|------------|
| `ADMIN_EMAIL` | First admin bootstrap (creates admin user on first boot) | Your email address |
| `ANTHROPIC_API_KEY` | AI features (investigation, review, insights, roadmap, ideation, changelog) | [console.anthropic.com](https://console.anthropic.com/) or Settings UI |
| `GITHUB_TOKEN` | GitHub issue sync, PR review, branch listing | GitHub Settings → Developer Settings → PATs or Settings UI |
| `JWT_SECRET` | Token persistence across server restarts (random fallback logs warning) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | OTP email delivery (falls back to console.log without it) | [resend.com](https://resend.com/) |
| `OTP_FROM_EMAIL` | Sender address for OTP emails | e.g. `otp@yourdomain.com` |

Optional variables: `PORT` (default 3001), `ALLOWED_ORIGINS` (CORS), `DB_PATH` (default `./data/aperant.db`), `AI_MODEL` (default `claude-sonnet-4-20250514`).

API keys (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) can alternatively be set via the Settings UI — the server checks the settings DB first, falling back to env vars. GitLab token and instance URL can also be set via Settings.

### Run

```bash
# Development (API server + Vite dev server with hot reload)
npm run dev

# Client: http://localhost:5173
# API:    http://localhost:3001
```

On first launch, set `ADMIN_EMAIL` in `.env`. The server auto-creates an admin user for that email on boot. Navigate to http://localhost:5173 and log in with the OTP sent to your email (or check the console if `RESEND_API_KEY` is not set).

### Build for Production

```bash
npm run build           # Type-check + Vite build
npm run build:server    # Server TypeScript only
npm run preview         # Run built server (serves client from dist/)
```

### Lint & Type-Check

```bash
npm run typecheck       # TypeScript strict mode check
npm run lint            # Biome linter
npm run lint:fix        # Auto-fix lint issues
```

---

## Testing Guide

### Manual Testing Checklist

#### Auth & Account
- [ ] Set `ADMIN_EMAIL` in `.env`, start server — admin user is auto-created
- [ ] Navigate to http://localhost:5173 — login page appears
- [ ] Enter admin email → receive OTP (check console if no Resend key) → enter code → logged in
- [ ] Verify email and logout button appear in sidebar
- [ ] Log out and log back in
- [ ] Refresh the page — token persists, user stays logged in
- [ ] Open a new incognito window — requires login (no shared state)
- [ ] As admin, go to Settings → User Management → add a new user email with member role
- [ ] Log in as the new member — verify they cannot access admin-only features (product CRUD, settings)

#### Products
- [ ] Create a product (name + color picker)
- [ ] Edit product settings (name, color, GitHub owner/repo)
- [ ] Switch between products in the sidebar

#### Kanban Board & Tasks
- [ ] Create tasks with different priorities (low/medium/high/urgent) and categories (feature/bug/etc.)
- [ ] Edit a task inline (change title, description, status, priority, category)
- [ ] Delete a task (confirm the two-step deletion dialog)
- [ ] **Sort view:** Use search box to filter tasks by text. Use priority and category dropdowns. Change sort order (newest/oldest/priority).
- [ ] **Priority view:** Toggle to Priority view via the header button. Drag a task above/below another task in the same column. Refresh the page — order is preserved.
- [ ] **Cross-column drag:** Drag a task from Backlog to In Progress — status changes.
- [ ] **Consolidated backlog:** Click "All Products" — see all tasks with colored product badges. Filters and priority ordering work across products.

#### GitHub Integration (requires GITHUB_TOKEN env var or configured in Settings)
- [ ] Set GitHub owner/repo in product settings
- [ ] **Issues page:** See split-pane list. Search by text, filter by state (open/closed/all). Scroll to load more (infinite scroll). Click an issue to see detail panel (labels, assignees, milestone, body). Click "Import as Task".
- [ ] **AI Investigation:** Click "Investigate" on an issue. See streaming progress bar and markdown output. Verify it covers root cause, affected areas, and proposed solution.
- [ ] **PRs page:** See PR list with state icons, diff stats. Click a PR for detail (branch info, files, labels). Click "AI Review" — see streaming code review output.
- [ ] **Create PR:** Open a task, click "Create PR", select branches, submit.

#### GitLab Integration (configure in Settings)
- [ ] Enter GitLab token + instance URL in Settings → save
- [ ] Create a product with a `gitlab_project` source (path e.g. `group/project`)
- [ ] **GitLab Issues:** See split-pane list, filter by state, search, click for detail. Import as task — verify labels have color and metadata has `sourceType: 'gitlab'`
- [ ] **GitLab MRs:** See MR list, filter by state (includes "merged"), click for detail

#### AI Features (requires ANTHROPIC_API_KEY env var or configured in Settings)
- [ ] **Insights:** Navigate to Insights. Create a session. Send a message asking about the codebase. See streaming response with tool badges (Read, Glob, Grep). Create a second session. Rename it. Delete it.
- [ ] **Roadmap:** Navigate to product Roadmap. Click Generate. See SSE progress. View phases, features grid, and priority (MoSCoW) views. Click a feature to see detail panel.
- [ ] **Ideation:** Navigate to product Ideation. Click Generate. See progress overlay. When done, browse ideas by type tab. Click an idea for detail (rationale, severity, files). Dismiss an idea. Convert an idea to task.
- [ ] **Changelog:** Navigate to product Changelog. Select source mode, format, audience. Click Generate. See streaming output. Toggle edit/preview. Copy to clipboard. Save. See it in the history sidebar.

#### Settings
- [ ] **Theme:** Toggle Light/Dark/System. Verify UI updates.
- [ ] **Color theme:** Click each of the 7 themes (Default, Ocean, Forest, Dusk, Lime, Retro, Neo). Verify color changes.
- [ ] **Language:** Switch to French. Verify all nav, buttons, labels change. Switch back to English.
- [ ] **API keys:** Enter/update Anthropic key and GitHub token. Verify they show as masked (`••••••••`) after save. Verify AI features and GitHub sync work using keys from Settings (without env vars).
- [ ] **Sync interval:** Change sync interval. Verify it accepts values 10-3600 and saves successfully (sent as string).

#### Real-Time Sync
- [ ] Trigger a manual sync (product page → sync button in header)
- [ ] See toast notification on sync complete/error
- [ ] Open two browser tabs. Create a task in one tab. Verify it appears in the other tab via SSE auto-refresh.

#### Security
- [ ] Try accessing `/api/products` without a token — should return 401
- [ ] Try accessing `/api/products` with an invalid token — should return 401
- [ ] Try accessing `/api/events` without a token — should return 401
- [ ] Hit `/api/auth/request-otp` rapidly — rate limiter kicks in (5 per email per 15 min)
- [ ] Request OTP for non-whitelisted email — same response as whitelisted (no information leak)
- [ ] As viewer, try to create a task — should return 403
- [ ] As member, try to access settings endpoints — should return 403
- [ ] Verify API responses for settings don't leak API key values (should show `••••••••`)
- [ ] Start server without `JWT_SECRET` — verify warning is logged about token invalidation on restart

### Automated Checks

```bash
npm run typecheck   # TypeScript type checking (strict mode)
npm run lint        # Biome linting
```

### API Smoke Tests

```bash
# Health check (public, no auth needed)
curl http://localhost:3001/api/health
# → {"status":"ok","timestamp":"..."}

# Request OTP (ADMIN_EMAIL must be set and server bootstrapped)
curl -s -X POST http://localhost:3001/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}' | jq .
# → {"message":"If this email is registered, a code has been sent"}

# Verify OTP (check console for code if RESEND_API_KEY not set)
curl -s -X POST http://localhost:3001/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","code":"123456"}' | jq .
# → {"token":"...","user":{"id":"...","email":"admin@example.com","role":"admin"}}

# Save the token, then:
TOKEN="<paste token here>"

# List products
curl -s http://localhost:3001/api/products -H "Authorization: Bearer $TOKEN" | jq .

# Create a product
curl -s -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"My App","color":"#3b82f6"}' | jq .

# Create a task
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"<product-id>","title":"First task","description":"Test","priority":"high","category":"feature"}' | jq .

# List all tasks (consolidated)
curl -s http://localhost:3001/api/tasks -H "Authorization: Bearer $TOKEN" | jq .

# SSE event stream (hold open, requires auth token)
curl -N "http://localhost:3001/api/events?token=$TOKEN"
# → :heartbeat (every 30s)
```

---

## Conventions

- **i18n required** — All UI text uses `react-i18next`. Add keys to both `en/*.json` and `fr/*.json`.
- **Zod validation** — All API inputs validated server-side via Zod schemas.
- **Typed API client** — All endpoints in `client/lib/api-client.ts` with proper types. Use `authenticatedFetch()` for raw responses (SSE streams) or `request()` via `api.*` for JSON. Never use raw `fetch()` for protected endpoints.
- **SSE for streaming** — AI responses stream via SSE with `text-delta`, `progress`, `done` events.
- **Auth required** — All routes (including SSE) use `requireAuth` middleware. Auth routes are public. SSE uses `?token=` query param since `EventSource` can't set headers.
- **Config resolution** — Server routes resolve API keys via `resolveConfig(settingsKey, envVar)` from `server/config-resolver.ts` (settings DB first, env var fallback). Never read `process.env` directly for user-configurable keys.
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
