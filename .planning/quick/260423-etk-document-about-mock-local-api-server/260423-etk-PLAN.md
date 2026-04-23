---
phase: quick-260423-etk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/README.md
autonomous: true
requirements:
  - document-mock-local-api-server

must_haves:
  truths:
    - "Developer can set up mock local environment without any real credentials using only the README"
    - "All 6 intercepted mock routes are documented with method, path, fixture shape, and real-API differences"
    - "Quick-start section provides the exact 4 commands in order (env setup, seed, API server, Vite)"
    - "Troubleshooting section covers all 5 known pitfalls with cause and fix"
    - "Existing README content (deployment, architecture, features, scripts, testing, API reference) is preserved intact"
  artifacts:
    - path: "apps/web/README.md"
      provides: "Local Development section with quick-start, architecture overview, mock route reference, and troubleshooting"
      contains: "Local Development"
  key_links:
    - from: "apps/web/README.md Local Development section"
      to: "apps/web/scripts/dev-server.ts"
      via: "startup command reference"
      pattern: "dev-server.ts"
    - from: "apps/web/README.md Local Development section"
      to: "apps/web/scripts/mocks/github-fixtures.ts"
      via: "mock route table"
      pattern: "github-fixtures"
---

<objective>
Add a comprehensive "Local Development" section to `apps/web/README.md` documenting the mock local API server system.

Purpose: Developers can onboard to local development without real Turso, GitHub OAuth, or GitHub API credentials.
Output: Updated README.md with quick-start guide, mock route reference (all 6 routes), and troubleshooting section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/README.md
@apps/web/scripts/mocks/github-fixtures.ts
@apps/web/scripts/dev-server.ts
@apps/web/api/_lib/db/client.ts
@apps/web/scripts/seed.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Local Development section to apps/web/README.md</name>
  <files>apps/web/README.md</files>
  <action>
Read `apps/web/README.md` in full to locate the best insertion point, then insert a new "## Local Development" section after the "## Architecture" heading (or after "## Scripts" if Architecture is not present — check first).

The section must contain the following subsections in this order:

### How It Works

One short paragraph explaining: the mock system eliminates the need for Turso credentials, GitHub OAuth, and a real GitHub PAT. It is gated behind `MOCK_SERVICES=true`. The Express dev server (`scripts/dev-server.ts`) serves all Vercel serverless functions locally on port 3001. A mock middleware layer (`scripts/mocks/github-fixtures.ts`) intercepts GitHub API and OAuth routes before real handlers and returns fixture data. Vite proxies all `/api` requests to port 3001. The local DB is a SQLite file (`dev.db`) via `@libsql/client`.

### Quick Start

Include a table of the three required env vars:

| Variable | Value | Purpose |
|---|---|---|
| `MOCK_SERVICES` | `true` | Switches DB to `file:dev.db`, registers mock middleware |
| `VITE_MOCK_SERVICES` | `true` | Exposes mock flag to Vite frontend |
| `JWT_SECRET` | any long random string | Stable JWT signing across restarts |

Then the exact 4-step bash commands (in a single fenced block with numbered comments):

```bash
# 1. Add mock vars to .env.local (run from apps/web/)
echo "MOCK_SERVICES=true" >> .env.local
echo "VITE_MOCK_SERVICES=true" >> .env.local
echo "JWT_SECRET=any-long-random-string" >> .env.local

# 2. Seed local SQLite with fake data
npx tsx scripts/seed.ts

# 3. Terminal A — start the API dev server (port 3001)
npx tsx scripts/dev-server.ts

# 4. Terminal B — start the Vite frontend (port 5173)
npm run dev
```

Add a note: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `GITHUB_TOKEN` are not needed in mock mode. Also add a warning block: **MOCK_SERVICES=true must never be set in Vercel/production** — the DB client will throw if `VERCEL` env is also set.

### Seed Data

Describe what `seed.ts` produces (idempotent — deletes and reseeds on each run):
- 1 admin user: `dev-admin@github.invalid` / `Dev Admin` / `role: 'admin'`
- 3 products: org `mock-org`, repos `project-alpha`, `project-beta`, `project-gamma`
- 8 tasks per product (one per Kanban status: backlog, queue, in_progress, ai_review, human_review, done, pr_created, error)
- 3 `issue_triage` records per product: issue #1 triaged `priority: high`; issues #2 and #3 untriaged

### Mock Routes

Add a brief intro sentence: "All routes below are intercepted before real handlers (first-match wins). Mock middleware is only registered when `MOCK_SERVICES=true`."

Then document all 6 routes as subsections or a structured list. For each route include: HTTP method + path, behaviour description, response shape (JSON code block), and a "vs. real API" note.

Routes to document (use the exact data from RESEARCH.md):

1. `GET /api/auth/github` — OAuth initiate bypass
2. `GET /api/auth/github/callback` — Issues JWT for seeded admin user; upserts to dev.db
3. `GET /api/github/repos/:owner/:repo/issues` — Returns 20 fixture issues (15 open, 5 closed); supports `?state=open|closed|all`
4. `GET /api/github/repos/:owner/:repo/labels` — Returns same 5 labels for every repo
5. `GET /api/triage/:owner/:repo?numbers=1,2,3` — Reads from dev.db via real DB logic
6. `POST /api/github/repos/:owner/:repo/issues/:number/comment` — Persists to dev.db; returns synthetic comment with timestamp-based ID

For routes 3, 4, and 6 include the full response shape JSON blocks from RESEARCH.md.

### Troubleshooting

Document all 5 pitfalls as a list with bold problem name, cause, and fix:

1. `.env.local` not in `apps/web/` — server connects to Turso, fails with missing `TURSO_DATABASE_URL`
2. Seed not run after schema change — SQL errors or missing `dev.db`
3. `JWT_SECRET` not set — tokens invalid after server restart
4. Only one terminal running — 404s for `/api/*` (Vite proxies to port 3001 which isn't listening)
5. `MOCK_SERVICES=true` in production — DB client throws; GitHub OAuth completely bypassed

Do NOT alter any existing section of the README. Only insert the new section. Preserve all existing headings, content, and formatting exactly.
  </action>
  <verify>
    <automated>grep -n "## Local Development" apps/web/README.md && grep -c "MOCK_SERVICES" apps/web/README.md && grep -c "/api/auth/github" apps/web/README.md && grep -c "Troubleshooting" apps/web/README.md</automated>
  </verify>
  <done>
    - `## Local Development` section exists in apps/web/README.md
    - All 6 mock routes are documented (grep for `/api/auth/github`, `/api/github/repos`, `/api/triage`)
    - Quick-start commands block is present (`dev-server.ts` and `seed.ts` referenced)
    - Troubleshooting section present with at least 5 items
    - All pre-existing README sections remain intact (deployment, architecture, features, scripts, testing, API reference)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Documentation only | No code changes — no trust boundaries introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-etk-01 | Information Disclosure | README.md | accept | Documentation intentionally describes mock credentials (`dev-admin@github.invalid`, `mock-org`) — these are dev-only fixture values with no production access. Production warning is explicitly documented. |
</threat_model>

<verification>
- `grep -n "## Local Development" apps/web/README.md` returns a line number
- `grep -c "MOCK_SERVICES" apps/web/README.md` returns >= 5 (multiple mentions across env table, commands, warning, pitfalls)
- `grep "dev-server.ts" apps/web/README.md` returns a match
- `grep "seed.ts" apps/web/README.md` returns a match
- `grep "/api/auth/github" apps/web/README.md` returns at least 2 matches (routes 1 and 2)
- `grep "/api/github/repos" apps/web/README.md` returns matches (routes 3, 4, 6)
- `grep "/api/triage" apps/web/README.md` returns a match (route 5)
- `grep "Troubleshooting" apps/web/README.md` returns a match
- Existing content check: `grep "Deployment" apps/web/README.md` still returns a match
</verification>

<success_criteria>
A developer with no Turso, GitHub OAuth, or GitHub API credentials can read `apps/web/README.md` → "Local Development" section and complete a full local dev setup by following the documented steps. All 6 mock routes are discoverable with their response shapes. All 5 known pitfalls are documented with fixes.
</success_criteria>

<output>
After completion, create `.planning/quick/260423-etk-document-about-mock-local-api-server/260423-etk-SUMMARY.md` using the summary template.
</output>
