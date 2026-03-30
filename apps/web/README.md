# Aperant Web

A multi-product backlog platform for managing tasks, GitHub/GitLab issues, AI-powered code review, and strategic planning — all from the browser.

This is the web version of the [Aperant desktop app](../desktop/), replacing Electron IPC with a REST + SSE API server and the Electron renderer with a React SPA.

## Quick Start

```bash
# 1. Install dependencies
cd apps/web
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY for AI features

# 3. Start development servers (API + Vite dev server)
npm run dev
```

The app starts at **http://localhost:5173** (client) with the API at **http://localhost:3001**.

On first launch, register an account — the first user is automatically made admin.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI features | Anthropic API key for investigation, review, insights, roadmap, ideation, changelog |
| `GITHUB_TOKEN` | For GitHub features | GitHub PAT for issue sync, PR review, branch listing |
| `JWT_SECRET` | Recommended | HMAC-SHA256 secret for JWT tokens. If unset, a random one is generated per server start (tokens won't survive restarts) |
| `PORT` | No | API server port (default: `3001`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (default: `http://localhost:5173,http://localhost:3001`) |
| `DB_PATH` | No | SQLite database path (default: `./data/aperant.db`) |
| `AI_MODEL` | No | Default AI model (default: `claude-sonnet-4-20250514`) |

GitLab tokens and instance URL can be configured via the Settings UI or environment variables.

## Architecture

```
React SPA (Vite)  →  REST + SSE  →  Express API Server  →  SQLite
     :5173              :3001              ↓
                                  Vercel AI SDK → Anthropic API
                                          ↓
                                  GitHub / GitLab APIs
```

- **Frontend:** React 19, TypeScript, Vite 7, Zustand 5, Tailwind CSS v4, Radix UI, dnd-kit
- **Backend:** Express 5, TypeScript, better-sqlite3, Zod validation, express-rate-limit
- **AI:** Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic`)
- **i18n:** react-i18next with English + French (12 namespaces)

The Vite dev server proxies `/api/*` to the Express server. In production, serve the built client as static files from Express.

## Features

### Task Management
- **Consolidated backlog** — View all tasks across all products on a single Kanban board
- **Per-product boards** — Filter to a single product's tasks
- **Dual-view Kanban** — Toggle between Sort view (search, filter, sort) and Priority view (manual drag-to-reorder with persisted ordering)
- **4 Kanban columns** — Backlog, In Progress, Review, Done (with drag-and-drop status changes)
- **Task CRUD** — Create, edit, delete tasks with priority (4 levels) and category (9 types)
- **Product badges** — Colored dot + name on each task card in consolidated view

### GitHub Integration
- **Issues** — Split-pane list with search, state filter, infinite scroll, import-to-task
- **AI Investigation** — Streaming analysis of issue root cause, affected areas, proposed solution
- **Pull Requests** — List with detail view, diff stats, file changes
- **AI Code Review** — Streaming review covering security, logic, performance, style
- **PR Creation** — Create PRs from the task edit dialog

### GitLab Integration
- **Issues** — Split-pane list with state filter, search, pagination
- **Merge Requests** — List with state filter (opened/closed/merged), branch info, merge status
- Self-hosted instance URL support (HTTPS required, configurable in Settings)

### AI-Powered Features
All AI features use SSE streaming for real-time output.

- **Insights** — Multi-session AI chat for exploring codebases (agent has Read, Glob, Grep, WebFetch tools)
- **Roadmap** — AI-generated strategic roadmap with phases, features, MoSCoW prioritization
- **Ideation** — AI auto-discovery across 6 categories (code, UI/UX, docs, security, performance, quality)
- **Changelog** — AI-generated release notes with 3 formats, 3 audiences, 3 source modes

### Settings & Auth
- **Appearance** — Light/Dark/System mode, 7 color themes
- **Language** — English / French
- **API Keys** — Anthropic + GitHub token management (masked in responses)
- **Auth** — JWT-based with admin/member/viewer roles. First user is auto-admin.
- **Rate limiting** — Auth endpoints (20/15min), AI endpoints (15/min)

### Real-Time
- **SSE event stream** — Auto-reconnect with exponential backoff
- **Toast notifications** — Sync status, errors, task changes
- **Auto-refresh** — Stores update on relevant SSE events

## Project Structure

```
apps/web/
├── src/
│   ├── client/                  # React SPA
│   │   ├── components/          # UI components (20+)
│   │   │   ├── ui/              # Radix-based primitives (badge, button, dialog, etc.)
│   │   │   ├── KanbanBoard.tsx  # Dual-view board (sort + priority)
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   └── ...
│   │   ├── hooks/               # Custom hooks (filters, SSE, toast, sync)
│   │   ├── stores/              # Zustand stores (13 stores)
│   │   ├── lib/                 # API client, i18n, utils
│   │   ├── styles/              # Tailwind globals
│   │   ├── App.tsx              # Router + layouts
│   │   └── main.tsx             # Entry point
│   ├── server/                  # Express API server
│   │   ├── ai/                  # AI layer (providers, session, tools, config)
│   │   ├── auth/                # JWT + password hashing
│   │   ├── db/                  # SQLite schema + per-table modules (8 files)
│   │   ├── middleware/          # Auth middleware
│   │   ├── routes/              # Express routers (14 route files)
│   │   ├── sync/                # GitHub sync engine + scheduler
│   │   ├── validation.ts        # Zod schemas
│   │   └── index.ts             # Server entry point
│   └── shared/                  # Shared between client + server
│       ├── types/               # TypeScript types (8 type files)
│       └── i18n/locales/        # en/*.json + fr/*.json (12 namespaces each)
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
1. `cp .env.example .env` and set `ANTHROPIC_API_KEY`
2. `npm install && npm run dev`
3. Open http://localhost:5173

**Auth:**
- [ ] Register a new account at first launch
- [ ] Log out and log back in
- [ ] Token persists across page refresh

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

**GitHub (requires `GITHUB_TOKEN`):**
- [ ] Configure product with GitHub owner/repo in product settings
- [ ] Navigate to Issues — see split-pane list with search and state filter
- [ ] Click an issue — see detail panel with labels, assignees, body
- [ ] Click "Import as Task" — task created in backlog
- [ ] Click "Investigate" — AI streams analysis via SSE
- [ ] Navigate to PRs — see list with diff stats
- [ ] Click a PR — see branch info, files, labels
- [ ] Click "AI Review" — streaming code review

**GitLab (configure in Settings):**
- [ ] Enter GitLab token + instance URL in Settings
- [ ] Navigate to GitLab Issues — see issues from your project
- [ ] Navigate to GitLab MRs — see merge requests

**AI Features (requires `ANTHROPIC_API_KEY`):**
- [ ] Insights — create a chat session, ask about the codebase, see streaming response with tool usage
- [ ] Roadmap — generate a roadmap for a product, see phases and features
- [ ] Ideation — generate ideas, filter by type, view details, convert to task
- [ ] Changelog — configure format/audience/source, generate, see preview

**Settings:**
- [ ] Toggle dark/light/system mode
- [ ] Switch color theme — see preview dots
- [ ] Switch language to French — all UI text changes
- [ ] Set Anthropic API key (masked after save)

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
# Register (first user becomes admin)
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","name":"Admin","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'
# Returns: { "token": "...", "user": { ... } }

# List products (use token from login)
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
