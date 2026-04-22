# Currents Web Platform — Feature Spec

> **Purpose:** Complete reference for everything built in the web version of the Currents desktop app. Use this to review features, find code, and plan future work.

## Overview

Currents Web is a GitHub Issues triage platform that brings the desktop Electron app's task and product management features to the browser. Multiple team members manage tasks across GitHub repositories through a shared web interface. Vercel serverless functions + Turso (cloud SQLite) replace Electron IPC, and a React SPA replaces the Electron renderer.

**Architecture:**
```
React SPA (Vercel Static) → /api/* → Vercel Serverless Functions → Turso (LibSQL) + GitHub API
```

**Tech Stack:**

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript (strict), Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit, react-router-dom, react-i18next |
| Backend | Vercel serverless functions (@vercel/node), TypeScript, @libsql/client (Turso), Zod, uuid |
| Testing | Vitest, Biome (linting) |
| i18n | i18next + react-i18next, 5 namespaces, English + French |

---

## Application Structure

### Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ConsolidatedView` | All tasks across all products in a unified Kanban board |
| `/products/:productId` | `ProductView` | Single product's tasks in a Kanban board |
| `/products/:productId/settings` | `ProductSettings` | Product configuration (name, color, GitHub repo) |
| `/settings` | `Settings` | Global app settings |

### API Endpoints

| Prefix | Router | Auth | Description |
|--------|--------|------|-------------|
| `/api/auth` | `api/auth/*` | Public | OTP login, user management (admin) |
| `/api/events` | `api/events/poll.ts` | Bearer | Event polling endpoint |
| `/api/health` | `api/health.ts` | Public | Health check |
| `/api/products` | `api/products/*` | JWT + admin | Product CRUD |
| `/api/tasks` | `api/tasks/*` | JWT + member | Task CRUD + ordering |
| `/api/github` | `api/github/*` | JWT | GitHub API proxy |
| `/api/settings` | `api/settings/*` | JWT | App settings CRUD |

### Sidebar Navigation

- **All Products** → `/` (consolidated backlog)
- **Per-product links** → `/products/:id` (click product name in sidebar)
- **Settings** → `/settings` (bottom)

### i18n Namespaces

`common`, `navigation`, `tasks`, `settings`, `auth`

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
- **Drag-and-drop** — Move tasks between status columns, reorder within columns (priority view)

Key files:
- `api/tasks/` — CRUD + status + ordering endpoints
- `api/_lib/db/tasks.ts` — Turso database operations
- `client/components/CreateTaskDialog.tsx`, `TaskEditDialog.tsx`
- `shared/types/task.ts` — Task, TaskStatus, TaskPriority, TaskCategory types

### 2b. GitHub Write-Back Sync

When a task linked to a GitHub issue is edited, changes are pushed back to GitHub:

- **Fields synced:** title, body (description), state (open/closed), labels, assignees
- **Status mapping:** Moving to "Done" closes the issue; moving out of "Done" reopens it
- **Project board:** If the task came from a GitHub Project, the board column is updated via GraphQL using the reversed `statusMapping` from the product config
- **Failure handling:** On GitHub API failure, the task saves locally and is flagged `github_sync_pending`. The cron job retries pending write-backs every minute.
- **UI feedback:** Warning toast on sync failure; spinning sync icon on task cards with pending write-backs

Key files:
- `api/_lib/sync/github-writeback.ts` — `syncTaskToGitHub()`, `retryPendingWritebacks()`
- `api/tasks/[id]/index.ts`, `api/tasks/[id]/status.ts` — Call write-back after local save
- `api/cron/sync.ts` — Retry pending write-backs after pull sync

### 3–8, 10. Coming Soon

The following features are implemented on the `claude/multi-product-backlog-JVLE2` branch and will be added in follow-up PRs:

- **GitHub Issues Browser + AI Investigation** (Section 3)
- **GitHub PR Review** (Section 4)
- **Insights AI Chat** (Section 5)
- **Roadmap & Strategic Planning** (Section 6)
- **Ideation AI Auto-Discovery** (Section 7)
- **Changelog Generation** (Section 8)
- **GitLab Integration** (Section 10)

### 9. Settings & Configuration

Global app settings with immediate persistence.

- **Appearance:** Light/Dark/System mode, 7 color themes (Default, Ocean, Forest, Dusk, Lime, Retro, Neo)
- **Language:** English / Français toggle
- **API Keys:** GitHub token (show/hide toggle, masked in API responses). Keys saved in settings DB are used by API routes with env var fallback via `config-resolver.ts`.
- **Sync:** Interval configuration (10-3600 seconds, sent as string to match bulk settings schema)
- Server-side key-value store with whitelist validation
- Route: `/settings`

Key files:
- `client/components/Settings.tsx` — Full settings UI (uses `authenticatedFetch`)
- `api/settings/` — CRUD with key whitelist, sensitive value masking
- `api/_lib/config-resolver.ts` — Resolves config from DB settings then env var fallback
- `api/_lib/db/` — Database operations
- `client/stores/settings-store.ts`

### 11. Real-Time Sync & Notifications

Polling-based event system with toast notifications.

- Polling hook with 3-second interval, Bearer token passed via Authorization header
- Events stored in DB events table, polled by client: sync_complete, sync_error, sync_started, task_created, task_updated, task_deleted, tasks_reordered, product_updated
- Task mutations (create, update, status change, delete, reorder) write events to DB for multi-tab/multi-user sync
- Auto-refresh: task and product stores update on relevant events
- Toast system: success/error/info/warning with auto-dismiss (5s), colored icons, dismiss buttons
- GitHub sync runs via Vercel cron job every minute when GitHub token is available (settings DB or `GITHUB_TOKEN` env var)

Key files:
- `client/hooks/useEventPolling.ts` — Polling with 3-second interval
- `client/hooks/useToast.ts` — Zustand toast store
- `client/hooks/useSyncEvents.ts` — Event → store bridge + toast triggers
- `client/components/ToastContainer.tsx`
- `api/cron/sync.ts` — Vercel cron job for GitHub sync
- `api/_lib/sync/github-sync.ts` — GitHub sync logic
- `api/_lib/db/events.ts` — Event storage and retrieval
- `api/_lib/broadcast.ts` — Event broadcasting to DB

### 12. Multi-User Authentication

Whitelist-only email OTP authentication with role-based access control.

- **No self-registration** — Admin whitelists email addresses
- **Bootstrap** — `ADMIN_EMAIL` env var seeds the first admin on startup when zero users exist
- **OTP login** — User enters whitelisted email → receives 6-digit OTP via Resend → enters code → receives JWT (7-day expiry). Non-whitelisted emails get the same "check your email" response (no information leak)
- **Rate limiting** — Max 5 OTP requests per email per 15 minutes
- **Roles:** admin, member, viewer
- **Role enforcement** — `requireRole(...roles)` middleware applied to all route groups:
  - `requireRole('admin')`: settings, product CRUD, sync triggers
  - `requireRole('admin', 'member')`: task mutations
  - `requireAuth` only (any role): all GET/read endpoints, event polling
- **Resend integration** — `RESEND_API_KEY` + `OTP_FROM_EMAIL` env vars. Falls back to console.log in development
- Auth store persisted in localStorage via Zustand persist middleware
- Client auto-attaches JWT to all API requests via `authenticatedFetch()`

Key files:
- `api/_lib/auth/jwt.ts` — Token creation/verification, startup warning
- `api/_lib/auth/otp.ts` — OTP generation, storage, verification (5-minute expiry)
- `api/_lib/auth/email.ts` — Resend email delivery with dev fallback
- `api/auth/*.ts` — Request OTP, verify OTP, me, user management (admin)
- `api/_lib/auth/middleware.ts` — `requireAuth`, `requireRole(...roles)`, `requireAdmin`
- `api/_lib/db/users.ts` — User CRUD (password_hash nullable for OTP-only auth)
- `client/components/LoginPage.tsx` — Two-step OTP login form
- `client/stores/auth-store.ts` — `requestOtp()`, `verifyOtp()`, `checkSession()`
- `client/lib/api-client.ts` — Auto-attaches JWT token

### AI Provider Infrastructure

Coming soon — see `claude/multi-product-backlog-JVLE2` branch.

---

## Security Hardening

Applied across the entire API and client:

| Category | Implementation | Files |
|----------|---------------|-------|
| **JWT timing attacks** | `crypto.timingSafeEqual()` for signature comparison | `api/_lib/auth/jwt.ts` |
| **Auth middleware** | `requireAuth` + `requireRole()` applied to all routes; accepts Bearer header | `api/_lib/auth/middleware.ts` |
| **OTP rate limiting** | Max 5 OTP requests per email per 15 minutes (DB-based) | `api/_lib/auth/otp.ts` |
| **Settings validation** | Key whitelist on GET/DELETE, fixed-length secret masking | `api/settings/` |
| **Input validation** | Zod schemas on all mutating endpoints | `api/_lib/validation.ts` |
| **Security headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Cache-Control | `vercel.json` |
| **Client auth** | JWT auto-attached to all API requests via `authenticatedFetch()` and `request()` | `client/lib/api-client.ts` |
| **Config resolution** | API keys resolved from settings DB first, then env var fallback | `api/_lib/config-resolver.ts` |
| **Polling auth** | `/api/events/poll` requires JWT via Bearer token in Authorization header | `api/_lib/auth/middleware.ts`, `client/hooks/useEventPolling.ts` |
| **JWT secret warning** | Logs warning if `JWT_SECRET` is unset (random fallback invalidates tokens on restart) | `api/_lib/auth/jwt.ts` |

---

## Database Schema

Turso (cloud SQLite) tables (core release):

| Table | Migration | Description |
|-------|-----------|-------------|
| `products` | 000 | Product CRUD (id, name, color, github owner/repo) |
| `tasks` | 000 | Task management (id, productId, title, description, status, priority, category) |
| `task_order` | 000 | Persisted task ordering per scope + status |
| `sync_state` | 000 | GitHub sync state tracking |
| `settings` | 000 | Key-value app settings |
| `users` | 006 | User accounts (email, name, password_hash nullable, role) |
| `otp_codes` | 007 | OTP codes (email, code_hash, expires_at, used) |
| `events` | 008 | Event log for polling (`id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))`) |

---

## Setup & Installation

### Prerequisites

- Vercel account
- Turso account ([turso.tech](https://turso.tech/))
- Node.js 20+ (for local development)

### Deploy

1. **Create a Turso database:**
   ```bash
   turso db create currents
   turso db tokens create currents
   ```

2. **Link your GitHub repo to Vercel** — Import the repository in the Vercel dashboard, set the root directory to `apps/web`.

3. **Set environment variables** in Vercel project settings:

| Variable | Required For | How to Get |
|----------|-------------|------------|
| `TURSO_DATABASE_URL` | Database connection | `turso db show currents --url` |
| `TURSO_AUTH_TOKEN` | Database authentication | `turso db tokens create currents` |
| `ADMIN_EMAIL` | First admin bootstrap (creates admin user when zero users exist) | Your email address |
| `GITHUB_TOKEN` | GitHub issue sync, branch listing | GitHub Settings → Developer Settings → PATs or Settings UI |
| `JWT_SECRET` | Token persistence across deployments (random fallback logs warning) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY` | OTP email delivery (falls back to console.log without it) | [resend.com](https://resend.com/) |
| `OTP_FROM_EMAIL` | Sender address for OTP emails | e.g. `otp@yourdomain.com` |

`GITHUB_TOKEN` can alternatively be set via the Settings UI — the API checks the settings DB first, falling back to env vars.

### Local Development

```bash
cd apps/web
npm install

# Install Vercel CLI
npm i -g vercel

# Link to your Vercel project and pull env vars
vercel link
vercel env pull .env.local

# Run locally with Vercel dev
vercel dev
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
- [ ] Set `ADMIN_EMAIL` in Vercel env vars, deploy — admin user is auto-created on first request
- [ ] Navigate to your Vercel deployment URL — login page appears
- [ ] Enter admin email → receive OTP (check Vercel function logs if no Resend key) → enter code → logged in
- [ ] Verify email and logout button appear in sidebar
- [ ] Log out and log back in
- [ ] Refresh the page — token persists, user stays logged in
- [ ] Open a new incognito window — requires login (no shared state)
- [ ] Log in as a member — verify they cannot access admin-only features (product CRUD, settings)

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

#### Settings
- [ ] **Theme:** Toggle Light/Dark/System. Verify UI updates.
- [ ] **Color theme:** Click each of the 7 themes (Default, Ocean, Forest, Dusk, Lime, Retro, Neo). Verify color changes.
- [ ] **Language:** Switch to French. Verify all nav, buttons, labels change. Switch back to English.
- [ ] **API keys:** Enter/update GitHub token. Verify it shows as masked (`••••••••`) after save. Verify GitHub sync works using the key from Settings (without env var).
- [ ] **Sync interval:** Change sync interval. Verify it accepts values 10-3600 and saves successfully (sent as string).

#### Real-Time Sync
- [ ] Trigger a manual sync (product page → sync button in header)
- [ ] See toast notification on sync complete/error
- [ ] Open two browser tabs. Create a task in one tab. Verify it appears in the other tab via polling auto-refresh.

#### Security
- [ ] Try accessing `/api/products` without a token — should return 401
- [ ] Try accessing `/api/products` with an invalid token — should return 401
- [ ] Try accessing `/api/events/poll` without a token — should return 401
- [ ] Hit `/api/auth/request-otp` rapidly — rate limiter kicks in (5 per email per 15 min)
- [ ] Request OTP for non-whitelisted email — same response as whitelisted (no information leak)
- [ ] As viewer, try to create a task — should return 403
- [ ] As member, try to access settings endpoints — should return 403
- [ ] Verify API responses for settings don't leak API key values (should show `••••••••`)

### Automated Checks

```bash
npm run typecheck   # TypeScript type checking (strict mode)
npm run lint        # Biome linting
```

### API Smoke Tests

```bash
# Replace with your Vercel deployment URL
BASE_URL="https://your-app.vercel.app"

# Health check (public, no auth needed)
curl $BASE_URL/api/health
# → {"status":"ok","timestamp":"..."}

# Request OTP (ADMIN_EMAIL must be set)
curl -s -X POST $BASE_URL/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}' | jq .
# → {"message":"If this email is registered, a code has been sent"}

# Verify OTP (check Vercel function logs for code if RESEND_API_KEY not set)
curl -s -X POST $BASE_URL/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","code":"123456"}' | jq .
# → {"token":"...","user":{"id":"...","email":"admin@example.com","role":"admin"}}

# Save the token, then:
TOKEN="<paste token here>"

# List products
curl -s $BASE_URL/api/products -H "Authorization: Bearer $TOKEN" | jq .

# Create a product
curl -s -X POST $BASE_URL/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"My App","color":"#3b82f6"}' | jq .

# Create a task
curl -s -X POST $BASE_URL/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"<product-id>","title":"First task","description":"Test","priority":"high","category":"feature"}' | jq .

# List all tasks (consolidated)
curl -s $BASE_URL/api/tasks -H "Authorization: Bearer $TOKEN" | jq .

# Poll for events
curl -s "$BASE_URL/api/events/poll" -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Conventions

- **i18n required** — All UI text uses `react-i18next`. Add keys to both `en/*.json` and `fr/*.json`.
- **Zod validation** — All API inputs validated server-side via Zod schemas.
- **Typed API client** — All endpoints in `client/lib/api-client.ts` with proper types. Use `authenticatedFetch()` for raw responses or `request()` via `api.*` for JSON. Never use raw `fetch()` for protected endpoints. Polling endpoint uses the same `authenticatedFetch()` with Bearer token.
- **Auth required** — All routes use `requireAuth` middleware. Auth routes are public. Polling endpoint uses standard Bearer token authentication.
- **Config resolution** — API keys resolved from settings DB first, then env var fallback via `api/_lib/config-resolver.ts`.
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
