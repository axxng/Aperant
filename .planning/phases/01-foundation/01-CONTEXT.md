# Phase 1: Foundation - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers infrastructure prerequisites that all subsequent phases depend on:
1. `githubFetch()` surfaces rate-limit errors with typed `GitHubRateLimitError` and a `retryAfter` seconds field — no more generic pass-through of 429/403
2. `issue_triage` DB table created via migration with all required columns including `github_comment_id` and `comment_status`
3. GET and PUT `/api/triage/[owner]/[repo]/[number]` routes in place with auth and upsert semantics
4. Existing issues proxy extended to accept `labels` (comma-separated) and `assignee` filter params

No UI work in this phase. No React components. Pure backend / API layer.

</domain>

<decisions>
## Implementation Decisions

### Rate-Limit Error Surface

- **D-01:** `githubFetch()` throws a typed `GitHubRateLimitError` (custom error class) when it detects a 429 or a rate-limit 403 (identified by `x-ratelimit-remaining: 0` or `x-ratelimit-reset` header presence). No raw Response passthrough for rate-limit conditions.
- **D-02:** The API route catches `GitHubRateLimitError` and returns HTTP 429 with body `{ "error": "rate_limited", "retryAfter": <seconds> }` where `retryAfter` is derived from `x-ratelimit-reset` (Unix timestamp → seconds until reset). If `x-ratelimit-reset` header is absent (secondary rate limit), use a sensible fallback (e.g., 60 seconds).
- **D-03:** Both 429 and rate-limit 403 use the same unified error shape — client does not need to distinguish between primary and secondary rate limits.

### Triage API Routes

- **D-04:** GET `/api/triage/[owner]/[repo]/[number]` — when no triage record exists for the issue, returns **200** with a default empty state object: `{ isTriaged: false, priority: null, githubCommentId: null, commentStatus: null }`. Never returns 404 for a missing record.
- **D-05:** PUT `/api/triage/[owner]/[repo]/[number]` — **upsert** semantics. Creates the record if it does not exist, updates it if it does. No POST required. Body accepts any subset of `{ isTriaged, priority }` (comment fields are managed by the notes route in Phase 5, not by this PUT).
- **D-06:** Both routes require `authenticateRequest` from `api/_lib/auth/middleware.ts`. No anonymous access.

### `issue_triage` DB Schema

- **D-07:** Table primary key is composite: `(github_repo TEXT, github_issue_number INTEGER)` — same pattern as the `idx_tasks_github_unique` index on `tasks`. No UUID for triage records.
- **D-08:** `comment_status` values: `NULL` (no note posted yet), `'posted'` (GitHub comment confirmed, `github_comment_id` is set), `'failed'` (last POST attempt errored, user can retry). No `pending` state — the POST is synchronous.
- **D-09:** Full column set for `issue_triage`:
  ```sql
  CREATE TABLE IF NOT EXISTS issue_triage (
    github_repo TEXT NOT NULL,             -- "owner/repo" format
    github_issue_number INTEGER NOT NULL,
    is_triaged INTEGER NOT NULL DEFAULT 0, -- SQLite boolean: 0/1
    priority TEXT DEFAULT NULL,            -- 'critical'|'high'|'medium'|'low'|NULL
    github_comment_id INTEGER DEFAULT NULL,-- GitHub comment ID for idempotency
    comment_status TEXT DEFAULT NULL,      -- NULL|'posted'|'failed'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (github_repo, github_issue_number)
  );
  ```
- **D-10:** Migration name follows existing convention: `011_issue_triage`.

### Issues Proxy Filter Extension

- **D-11:** The existing `githubIssueQuerySchema` in `api/_lib/validation.ts` is extended to add `labels` (optional string, e.g. `"bug,feature"`) and `assignee` (optional string). Comma-separated labels are passed through to GitHub's API as-is — no server-side splitting or joining.
- **D-12:** Adding `labels` and `assignee` is **non-breaking** — both are optional and existing callers that omit them are unaffected.

### Claude's Discretion

- How `GitHubRateLimitError` is structured internally (class fields, extends Error, etc.) — Claude decides the cleanest implementation.
- Whether `requireAuth` middleware is checked via the existing `authenticateRequest` helper or a thin wrapper — follow existing route patterns.
- Whether the `issue_triage` migration runs in `ensureDb()` alongside existing migrations or as a standalone script — follow existing migration array pattern in `client.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing GitHub proxy
- `apps/web/api/_lib/github.ts` — `githubFetch()` function that needs rate-limit enhancement; `mapGitHubIssue()` helper
- `apps/web/api/github/repos/[owner]/[repo]/issues.ts` — existing issues proxy route to extend with labels/assignee params

### DB and migrations
- `apps/web/api/_lib/db/client.ts` — migration system (`MIGRATIONS` array, `ensureDb()`, `runMigrations()`); new `011_issue_triage` migration goes here
- `apps/web/api/_lib/db/tasks.ts` — pattern for DB helper functions; follow this pattern for a new `api/_lib/db/triage.ts`

### Auth middleware
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest()` used by all protected routes

### Validation
- `apps/web/api/_lib/validation.ts` — `githubIssueQuerySchema` to extend; Zod schema patterns to follow

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `githubFetch()` (`api/_lib/github.ts`): Returns raw `Response` today — needs to throw `GitHubRateLimitError` before returning when rate-limited
- `authenticateRequest()` (`api/_lib/auth/middleware.ts`): Used in every protected route — use the same pattern for triage routes
- `githubIssueQuerySchema` (`api/_lib/validation.ts`): Zod schema to extend with optional `labels` and `assignee` fields
- `mapGitHubIssue()` (`api/_lib/github.ts`): Existing issue mapper — available for reuse in Phase 2

### Established Patterns
- DB migration: `MIGRATIONS` array in `client.ts` — append `{ name: '011_issue_triage', sql: '...' }`; runs automatically via `ensureDb()` on every cold start
- Route structure: each route is a default-export handler receiving `(req: VercelRequest, res: VercelResponse)`, calling `ensureDb()` and `authenticateRequest()` at the top
- Error responses: `res.status(N).json({ error: '...' })` pattern used throughout
- Primary key pattern for GitHub-linked records: `tasks` uses `(github_repo, github_issue_number)` composite unique index — `issue_triage` follows the same

### Integration Points
- New triage route directory: `apps/web/api/triage/[owner]/[repo]/[number].ts` (or `index.ts`) — follows the same nested slug pattern as `api/github/repos/[owner]/[repo]/`
- `vercel.json` may need a new rewrite rule for `/api/triage/**` if not auto-detected — check existing rewrites
- The `github_comment_id` and `comment_status` columns are used by Phase 5 (Notes) — schema must be stable before that phase

</code_context>

<specifics>
## Specific Ideas

- The rate-limit seconds calculation: `retryAfter = Math.ceil(resetUnixTimestamp - Date.now() / 1000)` — clamp to `Math.max(0, ...)` so negative values don't confuse clients
- Priority enum values (lowercase in DB, display-cased in UI): `'critical'`, `'high'`, `'medium'`, `'low'` — consistent with the existing `taskPriorities` in `validation.ts` which uses lowercase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-21*
