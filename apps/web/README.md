# Aperant Web

A multi-product backlog management platform with consolidated and per-product Kanban views, GitHub issue sync, and OTP authentication — all from the browser.

This is the web version of the [Aperant desktop app](../desktop/), replacing Electron IPC with a REST + SSE API server and the Electron renderer with a React SPA.

## Quick Start

```bash
# 1. Install dependencies
cd apps/web
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set ADMIN_EMAIL for the initial admin account

# 3. Start development servers (API + Vite dev server)
npm run dev
```

The app starts at **http://localhost:5173** (client) with the API at **http://localhost:3001**.

On first launch, request an OTP code for the admin email — the first user is automatically made admin.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | Yes | Email address for the initial admin account |
| `RESEND_API_KEY` | Yes | Resend API key for sending OTP emails |
| `OTP_FROM_EMAIL` | Yes | Sender email address for OTP codes (must be verified in Resend) |
| `GITHUB_TOKEN` | For GitHub sync | GitHub PAT for pulling issues from repos and GitHub Projects into the backlog |
| `JWT_SECRET` | Recommended | HMAC-SHA256 secret for JWT tokens. If unset, a random one is generated per server start (tokens won't survive restarts) |
| `PORT` | No | API server port (default: `3001`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:5173,http://localhost:3001`) |
| `DB_PATH` | No | SQLite database path (default: `./data/aperant.db`) |

## Architecture

```
React SPA (Vite)  →  REST + SSE  →  Express API Server  →  SQLite
     :5173              :3001              ↓
                                   GitHub API
```

- **Frontend:** React 19, TypeScript, Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit
- **Backend:** Express 5, TypeScript, better-sqlite3, Zod validation, express-rate-limit
- **i18n:** react-i18next with English + French (8 namespaces)

The Vite dev server proxies `/api/*` to the Express server. In production, serve the built client as static files from Express.

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
- **Product configuration** — Set GitHub owner/repo per product in product settings
- **Sync scheduler** — Configurable sync interval to keep backlog in sync with GitHub
- **Task editing syncs to GitHub** — Changes to tasks linked to GitHub issues are pushed back

### Settings & Auth
- **Appearance** — Light/Dark/System mode, 7 color themes
- **Language** — English / French
- **GitHub token** — Token management for issue sync (masked in responses)
- **Auth** — OTP-based authentication with admin/member/viewer roles. First user is auto-admin.
- **Rate limiting** — Auth endpoints (20/15min)

### Real-Time
- **SSE event stream** — Auto-reconnect with exponential backoff
- **Toast notifications** — Sync status, errors, task changes
- **Auto-refresh** — Stores update on relevant SSE events

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
├── src/
│   ├── client/                  # React SPA
│   │   ├── components/          # UI components (15+)
│   │   │   ├── ui/              # Radix-based primitives (badge, button, dialog, etc.)
│   │   │   ├── KanbanBoard.tsx  # Dual-view board (sort + priority)
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   └── ...
│   │   ├── hooks/               # Custom hooks (filters, SSE, toast, sync)
│   │   ├── stores/              # Zustand stores (8 stores)
│   │   ├── lib/                 # API client, i18n, utils
│   │   ├── styles/              # Tailwind globals
│   │   ├── App.tsx              # Router + layouts
│   │   └── main.tsx             # Entry point
│   ├── server/                  # Express API server
│   │   ├── auth/                # JWT + OTP verification
│   │   ├── db/                  # SQLite schema + per-table modules (8 files)
│   │   ├── middleware/          # Auth middleware
│   │   ├── routes/              # Express routers (8 route files)
│   │   ├── sync/                # GitHub sync engine + scheduler
│   │   ├── validation.ts        # Zod schemas
│   │   └── index.ts             # Server entry point
│   └── shared/                  # Shared between client + server
│       ├── types/               # TypeScript types (5 type files)
│       └── i18n/locales/        # en/*.json + fr/*.json (8 namespaces each)
├── .env.example                 # Environment variable template
├── package.json
├── vite.config.ts               # Vite + Tailwind + /api proxy
├── tsconfig.json                # Client TypeScript config
├── tsconfig.server.json         # Server TypeScript config
├── SPEC.md                      # Complete feature specification
└── data/                        # SQLite database (auto-created, gitignored)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both API server + Vite dev server (with hot reload) |
| `npm run dev:server` | Start API server only (tsx watch) |
| `npm run dev:client` | Start Vite dev server only |
| `npm run build` | Build client (Vite) + type-check |
| `npm run build:server` | Build server TypeScript |
| `npm run preview` | Run production server (`dist/server/index.js`) |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | Run Biome linter |
| `npm run lint:fix` | Auto-fix lint issues |

## Testing

### Manual Testing Checklist

**Setup:**
1. `cp .env.example .env` and set `ADMIN_EMAIL`, `RESEND_API_KEY`, `OTP_FROM_EMAIL`
2. `npm install && npm run dev`
3. Open http://localhost:5173

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
- [ ] Open two browser tabs — changes in one appear in the other via SSE

### Automated

```bash
npm run typecheck   # TypeScript type checking
npm run lint        # Biome linting
```

## API Quick Reference

All protected endpoints require `Authorization: Bearer <token>` header.

```bash
# Request OTP code
curl -X POST http://localhost:3001/api/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com"}'

# Verify OTP and get token
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","code":"123456"}'
# Returns: { "token": "...", "user": { ... } }

# List products (use token from verify-otp)
curl http://localhost:3001/api/products \
  -H 'Authorization: Bearer <token>'

# Create a product
curl -X POST http://localhost:3001/api/products \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"My App","color":"#3b82f6","githubOwner":"org","githubRepo":"repo"}'

# Health check (public)
curl http://localhost:3001/api/health
```

See [SPEC.md](SPEC.md) for the complete feature specification, API route table, database schema, and security details.
