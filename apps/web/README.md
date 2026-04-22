# Currents Web

A multi-product backlog management platform with consolidated and per-product Kanban views, GitHub issue sync, and OTP authentication — all from the browser.

This is the web version of the [Currents desktop app](../desktop/), deployed on Vercel with serverless API functions and Turso (cloud SQLite).

## Deployment

### Prerequisites
- [Vercel account](https://vercel.com) (free tier)
- [Turso account](https://turso.tech) (free tier)
- GitHub repository linked to Vercel

### 1. Create Turso Database
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create currents

# Get connection URL
turso db show currents --url

# Create auth token
turso db tokens create currents
```

### 2. Connect GitHub to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Set **Root Directory** to `apps/web`
4. Framework will auto-detect as **Vite**
5. Add environment variables (see below)
6. Deploy

### 3. Set Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | Yes | Turso connection URL (e.g., `libsql://currents-yourorg.turso.io`) |
| `TURSO_AUTH_TOKEN` | Yes | Turso database auth token |
| `JWT_SECRET` | Yes | Random 32-byte hex for JWT signing. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` | Yes | Email for the initial admin account (auto-created on first request) |
| `RESEND_API_KEY` | For OTP emails | Resend API key for sending login codes (falls back to Vercel function logs) |
| `OTP_FROM_EMAIL` | For OTP emails | Sender address for OTP emails (must be verified in Resend) |
| `GITHUB_TOKEN` | For GitHub sync | GitHub PAT for pulling issues into the backlog |

### 4. First Login
1. Open your Vercel deployment URL
2. Enter the `ADMIN_EMAIL` address
3. Check email for OTP code (or check Vercel function logs if no Resend key)
4. Enter code → logged in as admin

## Architecture

```
React SPA (Vercel Static)  →  /api/*  →  Vercel Serverless Functions  →  Turso (LibSQL)
                                                    ↓
                                              GitHub API
```

- **Frontend:** React 19, TypeScript, Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit
- **Backend:** Vercel serverless functions (`@vercel/node`), `@libsql/client` (Turso), Zod validation
- **Real-time:** DB-backed event polling (3s interval)
- **Sync:** Vercel Cron job (every minute) for GitHub issue sync
- **i18n:** react-i18next with English + French (5 namespaces)

Every push to the linked GitHub branch triggers a Vercel preview deployment. Merging to the production branch deploys to production.

## Features

### Task Management
- **Consolidated backlog** — View all tasks across all products on a single Kanban board
- **Per-product boards** — Filter to a single product's tasks
- **Dual-view Kanban** — Toggle between Sort view (search, filter, sort) and Priority view (manual drag-to-reorder with persisted ordering)
- **4 Kanban columns** — Backlog, In Progress, Review, Done (with drag-and-drop status changes)
- **Task CRUD** — Create, edit, delete tasks with priority (4 levels) and category (9 types)
- **Product badges** — Colored dot + name on each task card in consolidated view

### GitHub Sync
- **Issue sync** — Pull issues from GitHub repos and GitHub Projects into the backlog
- **Write-back sync** — Task edits (title, description, status, labels, assignees) push back to GitHub issues
- **Project board sync** — Status changes update the GitHub Project board column
- **Retry on failure** — Failed write-backs retry automatically via cron (1-minute cycle)
- **Product configuration** — Set GitHub owner/repo per product in product settings
- **Sync scheduler** — Configurable sync interval to keep backlog in sync with GitHub

### Settings & Auth
- **Appearance** — Light/Dark/System mode, 7 color themes
- **Language** — English / French
- **GitHub token** — Token management for issue sync (masked in responses)
- **Auth** — OTP-based authentication with admin/member/viewer roles. First user is auto-admin.
- **Rate limiting** — Auth endpoints (20/15min)

### Real-Time
- **DB-backed event polling** — 3-second polling interval
- **Toast notifications** — Sync status, errors, task changes
- **Auto-refresh** — Stores update on relevant events

### Coming Soon

The following features are planned for follow-up PRs from the `claude/multi-product-backlog-JVLE2` branch:

- **GitHub Issues browser** — Split-pane issue list with search, state filter, infinite scroll, import-to-task
- **GitHub AI Investigation** — Streaming analysis of issue root cause, affected areas, proposed solution
- **GitHub PR list** — PR listing with detail view, diff stats, file changes
- **GitHub AI Code Review** — Streaming review covering security, logic, performance, style
- **PR Creation** — Create PRs from the task edit dialog
- **GitLab Integration** — Issues and merge requests with self-hosted instance support
- **AI Insights** — Multi-session AI chat for exploring codebases
- **AI Roadmap** — AI-generated strategic roadmap with phases, features, MoSCoW prioritization
- **AI Ideation** — Auto-discovery across 6 categories (code, UI/UX, docs, security, performance, quality)
- **AI Changelog** — AI-generated release notes with multiple formats and audiences
- **AI provider infrastructure** — Vercel AI SDK integration with Anthropic
- **User management admin panel** — Admin UI for managing users and roles

## Project Structure

```
apps/web/
├── api/                              # Vercel serverless API functions
│   ├── _lib/                         # Shared server code (not deployed as routes)
│   │   ├── db/                       # Turso database layer (async)
│   │   ├── auth/                     # JWT, OTP, auth middleware
│   │   ├── sync/                     # GitHub sync engine
│   │   ├── validation.ts             # Zod schemas
│   │   ├── config-resolver.ts        # Settings DB → env var fallback
│   │   ├── broadcast.ts              # Event log for polling
│   │   └── github.ts                 # GitHub REST + GraphQL helpers
│   ├── auth/                         # Auth endpoints (OTP login, user management)
│   ├── products/                     # Product CRUD + sync trigger
│   ├── tasks/                        # Task CRUD + ordering
│   ├── events/poll.ts                # Event polling endpoint
│   ├── settings/                     # Settings CRUD
│   ├── github/                       # GitHub API proxy
│   ├── cron/sync.ts                  # Vercel cron: GitHub sync + event cleanup
│   └── health.ts                     # Health check
├── src/
│   ├── client/                       # React SPA
│   │   ├── components/               # UI components
│   │   │   ├── ui/                   # Radix-based primitives
│   │   │   ├── KanbanBoard.tsx       # Dual-view board (sort + priority)
│   │   │   └── ...
│   │   ├── hooks/                    # Custom hooks (filters, polling, toast, sync)
│   │   ├── stores/                   # Zustand stores (8 stores)
│   │   ├── lib/                      # API client, i18n, utils
│   │   ├── styles/                   # Tailwind globals
│   │   └── App.tsx                   # Router + layouts
│   └── shared/                       # Shared types, i18n
├── vercel.json                       # Vercel config (headers, cron)
├── vite.config.ts                    # Vite build config
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build client (Vite) |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run Biome linter |
| `npm run lint:fix` | Auto-fix lint issues |

## Testing

### Manual Testing Checklist

**Setup:**
1. Deploy to Vercel and set environment variables
2. Open the deployment URL

**Auth:**
- [ ] Request an OTP code for the admin email
- [ ] Enter the OTP code to authenticate
- [ ] Token persists across page refresh
- [ ] Log out and request a new OTP to log back in

**Products & Tasks:**
- [ ] Create a product (name + color)
- [ ] Create tasks with different priorities and categories
- [ ] Edit a task inline (change title, status, priority)
- [ ] Delete a task (two-step confirmation)
- [ ] Drag task between columns to change status
- [ ] Switch to Priority view and reorder tasks within a column
- [ ] Refresh page — priority order is preserved
- [ ] Click "All Products" — see consolidated backlog with product badges on each card
- [ ] Switch to Sort view — use search, priority filter, category filter, sort options

**GitHub Sync (requires `GITHUB_TOKEN`):**
- [ ] Configure product with GitHub owner/repo in product settings
- [ ] Trigger a sync — issues pulled into backlog
- [ ] Verify synced tasks reflect GitHub issue data

**Settings:**
- [ ] Toggle dark/light/system mode
- [ ] Switch color theme — see preview dots
- [ ] Switch language to French — all UI text changes

**Real-Time:**
- [ ] Trigger a GitHub sync (product page > sync button)
- [ ] See toast notification on sync complete
- [ ] Open two browser tabs — changes in one appear in the other via polling

### Automated

```bash
npm run typecheck   # TypeScript type checking
npm run lint        # Biome linting
```

## API Quick Reference

All protected endpoints require `Authorization: Bearer <token>` header.

```bash
# Request OTP code
curl -X POST https://your-app.vercel.app/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}'

# Verify OTP and get token
curl -X POST https://your-app.vercel.app/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","code":"123456"}'
# Returns: { "token": "...", "user": { ... } }

# List products (use token from verify-otp)
curl https://your-app.vercel.app/api/products \
  -H 'Authorization: Bearer <token>'

# Create a product
curl -X POST https://your-app.vercel.app/api/products \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"My App","color":"#3b82f6","githubOwner":"org","githubRepo":"repo"}'

# Health check (public)
curl https://your-app.vercel.app/api/health
```

See [SPEC.md](SPEC.md) for the complete feature specification, API route table, database schema, and security details.
