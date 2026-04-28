# Phase 1: Foundation - Research

**Researched:** 2026-04-21
**Domain:** Vercel Serverless API routes, libSQL/Turso migrations, GitHub REST API rate-limit headers
**Confidence:** HIGH

## Summary

Phase 1 is a pure backend / infrastructure phase with no React UI work. It has three deliverables: (1) typed rate-limit error surfacing in `githubFetch()`, (2) the `issue_triage` DB migration, and (3) GET + PUT `/api/triage/[owner]/[repo]/[number]` routes plus a filter extension to the existing issues proxy.

All four deliverables follow patterns that already exist in the codebase with high fidelity. The DB client uses `@libsql/client` (Turso), not raw SQLite — the `executeMultiple()` method handles multi-statement migration SQL. The `MIGRATIONS` array in `client.ts` is the canonical migration mechanism; appending `011_issue_triage` is the only required change. The route filesystem structure follows Vercel's file-based routing: `api/triage/[owner]/[repo]/[number].ts` maps to `/api/triage/:owner/:repo/:number`. No new `vercel.json` rewrite rule is needed for file-based routes; Vercel auto-discovers them.

The GitHub rate-limit detection needs to handle two distinct cases: primary limits (429 or 403 with `x-ratelimit-remaining: 0`) and secondary limits (403/429 with a `retry-after` header rather than `x-ratelimit-remaining: 0`). Both should resolve to the same `GitHubRateLimitError` shape per decision D-03. The `retryAfter` seconds come from `x-ratelimit-reset` (Unix timestamp → seconds until reset) for primary limits, and from `retry-after` (already in seconds) for secondary limits, with a 60-second fallback when neither header is present.

**Primary recommendation:** Implement in three atomic units — error class + `githubFetch()` change, DB migration + triage helpers, triage routes + issues proxy extension — in that dependency order.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `githubFetch()` throws a typed `GitHubRateLimitError` when it detects a 429 or a rate-limit 403 (identified by `x-ratelimit-remaining: 0` or `x-ratelimit-reset` header presence). No raw Response passthrough for rate-limit conditions.
- **D-02:** The API route catches `GitHubRateLimitError` and returns HTTP 429 with body `{ "error": "rate_limited", "retryAfter": <seconds> }` where `retryAfter` is derived from `x-ratelimit-reset` (Unix timestamp → seconds until reset). If `x-ratelimit-reset` header is absent, use a sensible fallback (60 seconds).
- **D-03:** Both 429 and rate-limit 403 use the same unified error shape.
- **D-04:** GET `/api/triage/[owner]/[repo]/[number]` returns 200 with default empty state when no record exists — never 404.
- **D-05:** PUT `/api/triage/[owner]/[repo]/[number]` — upsert semantics. Body accepts any subset of `{ isTriaged, priority }`.
- **D-06:** Both routes require `authenticateRequest` from `api/_lib/auth/middleware.ts`.
- **D-07:** Table primary key is composite: `(github_repo TEXT, github_issue_number INTEGER)`.
- **D-08:** `comment_status` values: `NULL`, `'posted'`, `'failed'`. No `pending` state.
- **D-09:** Full column set for `issue_triage` as specified (see schema below).
- **D-10:** Migration name: `011_issue_triage`.
- **D-11:** `githubIssueQuerySchema` extended with optional `labels` (string) and `assignee` (string).
- **D-12:** Both new params are optional — non-breaking change.

### Claude's Discretion

- How `GitHubRateLimitError` is structured internally (class fields, extends Error, etc.)
- Whether `requireAuth` is checked via existing `authenticateRequest` helper or a thin wrapper — follow existing route patterns
- Whether the migration runs in `ensureDb()` alongside existing migrations or as standalone — follow existing migration array pattern in `client.ts`

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | When GitHub's rate limit is reached, users see an actionable error message (not a generic failure) indicating when they can retry | `githubFetch()` throws typed `GitHubRateLimitError`; API routes map it to HTTP 429 with `retryAfter` seconds |
| INFRA-02 | Triage state DB table is created in a single migration with all required columns, including comment idempotency fields (`github_comment_id`, `comment_status`) | `011_issue_triage` migration appended to `MIGRATIONS` array in `client.ts`; runs automatically via `ensureDb()` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rate-limit error detection | API / Backend (`githubFetch`) | — | Fetch wrapper owns transport-level error classification |
| Rate-limit error surfacing to client | API route layer | — | Routes translate domain errors to HTTP status codes |
| Triage state persistence | Database / Storage (`issue_triage` table) | — | Internal state, not GitHub-side; stored in Turso |
| Triage CRUD | API / Backend (`/api/triage/*` routes) | — | Auth-gated server-side logic |
| Issues filter extension | API / Backend (`issues.ts` proxy route) | — | Proxy passthrough to GitHub; validation in Zod schema |

## Standard Stack

### Core (already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@libsql/client` | `^0.14.0` | Turso/libSQL DB client | Already in `package.json`; migration system built on it |
| `zod` | `^3.24.4` | Schema validation | Already used in all routes for query/body validation |
| `@vercel/node` | `^5.0.0` | Vercel serverless types | Already used; `VercelRequest`/`VercelResponse` types |
| `typescript` | `^5.8.3` | Type safety | Already in use; strict mode |

All versions verified against existing `apps/web/package.json`. [VERIFIED: codebase]

### Supporting

No new dependencies are required for this phase. The entire implementation uses the existing stack.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `GitHubRateLimitError` class | Generic `Error` with properties | Custom class enables `instanceof` check in catch blocks — safer and cleaner |
| `retry-after` header for all rate limits | Only `x-ratelimit-reset` | Secondary rate limits send `retry-after` not `x-ratelimit-reset` — must check both |

**Installation:** No new packages needed for this phase.

## Architecture Patterns

### System Architecture Diagram

```
[Client Request]
      |
      v
[Vercel Route Handler]
  ensureDb() --> [MIGRATIONS array] --> Turso DB
  authenticateRequest() --> [JWT verify] --> 401 if invalid
      |
      +-- GET /api/triage/:owner/:repo/:number
      |     |
      |     v
      |   [triage.ts: getTriageRecord()]
      |     |
      |     +-- record found --> 200 { isTriaged, priority, ... }
      |     +-- not found   --> 200 { isTriaged: false, priority: null, ... }
      |
      +-- PUT /api/triage/:owner/:repo/:number
      |     |
      |     v
      |   [triage.ts: upsertTriageRecord()]
      |     |
      |     +-- INSERT OR REPLACE --> 200 updated record
      |
      +-- GET /api/github/repos/:owner/:repo/issues
            |
            v
          githubIssueQuerySchema (+ labels, assignee)
            |
            v
          githubFetch(GitHub API)
            |
            +-- 200 OK           --> map issues, return
            +-- GitHubRateLimitError --> catch --> 429 { error, retryAfter }
            +-- other non-ok     --> pass status through
```

### Recommended Project Structure (new files only)

```
apps/web/api/
├── _lib/
│   ├── github.ts              # MODIFY: add GitHubRateLimitError, update githubFetch()
│   ├── validation.ts          # MODIFY: extend githubIssueQuerySchema
│   └── db/
│       ├── client.ts          # MODIFY: append 011_issue_triage to MIGRATIONS
│       └── triage.ts          # NEW: getTriageRecord(), upsertTriageRecord()
└── triage/
    └── [owner]/
        └── [repo]/
            └── [number].ts    # NEW: GET + PUT handler
```

### Pattern 1: Custom Error Class (Claude's Discretion)

**What:** Extend `Error` with a typed `GitHubRateLimitError` class.
**When to use:** Whenever `githubFetch()` encounters a rate-limit response; thrown before returning.

```typescript
// Source: TypeScript patterns — [VERIFIED: codebase practices]
export class GitHubRateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`GitHub rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = 'GitHubRateLimitError';
    this.retryAfter = retryAfter;
  }
}
```

### Pattern 2: Rate-Limit Detection in `githubFetch()`

**What:** Inspect response status and headers before returning; throw `GitHubRateLimitError` on rate-limit conditions.
**When to use:** Immediately after `fetch()` returns in `githubFetch()`.

```typescript
// Source: GitHub docs — https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
// [VERIFIED: official docs]
export async function githubFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getGitHubToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  // Primary rate limit: 429 or 403 with x-ratelimit-remaining = 0
  // Secondary rate limit: 403/429 with retry-after header
  const isRateLimitStatus = response.status === 429 || response.status === 403;
  const remaining = response.headers.get('x-ratelimit-remaining');
  const retryAfterHeader = response.headers.get('retry-after'); // secondary: seconds
  const resetHeader = response.headers.get('x-ratelimit-reset');  // primary: unix timestamp

  const isPrimaryLimit = isRateLimitStatus && remaining === '0';
  const isSecondaryLimit = isRateLimitStatus && retryAfterHeader !== null;

  if (isPrimaryLimit || isSecondaryLimit) {
    let retryAfter: number;
    if (retryAfterHeader !== null) {
      // Secondary rate limit: retry-after is already in seconds
      retryAfter = Math.max(0, parseInt(retryAfterHeader, 10));
    } else if (resetHeader !== null) {
      // Primary rate limit: x-ratelimit-reset is a Unix timestamp
      retryAfter = Math.max(0, Math.ceil(parseInt(resetHeader, 10) - Date.now() / 1000));
    } else {
      retryAfter = 60; // fallback per D-02
    }
    throw new GitHubRateLimitError(retryAfter);
  }

  return response;
}
```

**Critical note:** Secondary rate limit 403 responses can have `x-ratelimit-remaining > 0` and no `x-ratelimit-reset`, but they do have a `retry-after` header. Check `retry-after` first to catch secondary limits correctly. [VERIFIED: GitHub docs]

### Pattern 3: Route Handler with GitHubRateLimitError catch

**What:** Existing route handlers need a specific catch for `GitHubRateLimitError`.

```typescript
// Source: [VERIFIED: existing codebase patterns]
  } catch (error: any) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
```

### Pattern 4: DB Migration Append

**What:** Append new migration object to `MIGRATIONS` array in `client.ts`.
**When to use:** One entry per schema change; runs automatically via `ensureDb()` idempotently.

```typescript
// Source: [VERIFIED: apps/web/api/_lib/db/client.ts]
{
  name: '011_issue_triage',
  sql: `
    CREATE TABLE IF NOT EXISTS issue_triage (
      github_repo TEXT NOT NULL,
      github_issue_number INTEGER NOT NULL,
      is_triaged INTEGER NOT NULL DEFAULT 0,
      priority TEXT DEFAULT NULL,
      github_comment_id INTEGER DEFAULT NULL,
      comment_status TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (github_repo, github_issue_number)
    );
  `,
},
```

### Pattern 5: Triage DB Helper (follow `tasks.ts` pattern)

**What:** New `api/_lib/db/triage.ts` with typed helpers.
**When to use:** Route handlers import from this module — never inline SQL in route files.

```typescript
// Source: [VERIFIED: apps/web/api/_lib/db/tasks.ts pattern]
export interface TriageRecord {
  githubRepo: string;
  githubIssueNumber: number;
  isTriaged: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  githubCommentId: number | null;
  commentStatus: 'posted' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TRIAGE: TriageRecord = {
  githubRepo: '',
  githubIssueNumber: 0,
  isTriaged: false,
  priority: null,
  githubCommentId: null,
  commentStatus: null,
  createdAt: '',
  updatedAt: '',
};
```

**Note on upsert syntax:** libSQL supports `INSERT OR REPLACE` and `ON CONFLICT` clauses — the same as SQLite. See `setTaskOrder()` in `tasks.ts` for `ON CONFLICT` upsert pattern. [VERIFIED: codebase]

### Pattern 6: Vercel Dynamic Route File Path

**What:** Vercel file-based routing maps filesystem paths to URL patterns.
**When to use:** New route files must use bracket notation for dynamic segments.

`apps/web/api/triage/[owner]/[repo]/[number].ts` → `/api/triage/:owner/:repo/:number`

No `vercel.json` rewrite rules are needed — Vercel auto-discovers serverless functions under `api/`. [VERIFIED: existing `vercel.json` which has no `functions` or `rewrites` blocks; only `headers` and `crons`]

Dynamic segment values are accessed via `req.query.owner`, `req.query.repo`, `req.query.number` (as strings). [VERIFIED: existing routes like `comment.ts`]

### Pattern 7: Validation Schema Extension

**What:** Extend `githubIssueQuerySchema` in `validation.ts` with optional string fields.
**When to use:** Non-breaking — both new fields are `.optional()`.

```typescript
// Source: [VERIFIED: apps/web/api/_lib/validation.ts]
export const githubIssueQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.string().regex(/^\d+$/).default('1'),
  per_page: z.string().regex(/^\d+$/).default('50'),
  labels: z.string().optional(),      // comma-separated, passed through as-is
  assignee: z.string().optional(),    // single login string
});
```

### Pattern 8: Issues Proxy Route Extension

**What:** After extending the schema, pass `labels` and `assignee` to GitHub API params.

```typescript
// Source: [VERIFIED: apps/web/api/github/repos/[owner]/[repo]/issues.ts]
const { state, page, per_page, labels, assignee } = queryResult.data;
const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });
if (labels) params.set('labels', labels);
if (assignee) params.set('assignee', assignee);
```

### Anti-Patterns to Avoid

- **Checking `response.status === 403` only for rate limits:** GitHub can return 403 for auth failures, repo not found, and permission errors — none of which are rate limits. Always check headers (`x-ratelimit-remaining` or `retry-after`) to confirm it's a rate-limit 403. [VERIFIED: GitHub docs]
- **Using `response.status === 429` as the only check:** Primary rate limits historically returned 403; code must handle both. [VERIFIED: GitHub docs]
- **Inline SQL in route handlers:** The codebase consistently separates SQL into `api/_lib/db/*.ts` helpers. Follow this pattern.
- **UUID primary key for triage records:** Decision D-07 locks composite PK `(github_repo, github_issue_number)` — matches the `tasks` table unique index pattern.
- **Writing `updated_at` via `DEFAULT (datetime('now'))`:** The `DEFAULT` only fires on INSERT. The upsert must explicitly set `updated_at = datetime('now')` in the UPDATE arm. [VERIFIED: codebase pattern — `tasks.ts` `updateTask()` sets `updated_at` explicitly]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB migrations | Custom migration runner | `MIGRATIONS` array + `runMigrations()` in `client.ts` | Already handles idempotency, ordering, and the `migrations` table |
| Auth check | Custom JWT decode | `authenticateRequest()` from `middleware.ts` | Handles Bearer + query token, returns `null` and sends 401 automatically |
| Zod schema validation | Manual type checks | `schema.safeParse(req.query)` / `req.body` | Returns typed data + structured errors |
| `retry-after` header parsing | Custom header logic | Straightforward `parseInt(header, 10)` per spec | Header is already in seconds for secondary limits |

**Key insight:** Every pattern needed in this phase has a direct precedent in the existing codebase. The research validates copying those patterns rather than introducing anything new.

## Common Pitfalls

### Pitfall 1: Missing Secondary Rate Limit Detection
**What goes wrong:** Code checks `x-ratelimit-remaining === '0'` but misses secondary rate limits which can have positive `remaining` values.
**Why it happens:** GitHub's two rate limit types use different headers. Secondary limits use `retry-after` (seconds), not `x-ratelimit-reset` (timestamp).
**How to avoid:** Check `retry-after` header presence first — if present on a 403/429, it's a secondary rate limit regardless of `x-ratelimit-remaining`.
**Warning signs:** 403 responses passing through as generic errors even after the rate-limit fix.

### Pitfall 2: Negative `retryAfter` Values
**What goes wrong:** Clock skew or stale reset timestamps yield a negative seconds value, confusing clients.
**Why it happens:** `x-ratelimit-reset - Date.now() / 1000` can go negative if the reset time has already passed.
**How to avoid:** Wrap with `Math.max(0, ...)` as noted in D-02 specifics.
**Warning signs:** Client receiving `retryAfter: -5`.

### Pitfall 3: `updated_at` Not Updated on Upsert
**What goes wrong:** `INSERT OR REPLACE` replaces the entire row with original `created_at` default; `ON CONFLICT DO UPDATE` must explicitly set `updated_at`.
**Why it happens:** libSQL's `DEFAULT (datetime('now'))` only fires on fresh INSERT, not on the UPDATE arm of a conflict clause.
**How to avoid:** Explicitly include `updated_at = datetime('now')` in the `DO UPDATE SET` clause.
**Warning signs:** `updated_at` never changes after initial creation.

### Pitfall 4: Route Catching Errors Before `GitHubRateLimitError`
**What goes wrong:** Route's existing `catch` block handles all errors as 500, so `GitHubRateLimitError` never produces a 429.
**Why it happens:** The existing `catch (error: any)` in `issues.ts` currently returns a generic 500 for all errors.
**How to avoid:** Add `instanceof GitHubRateLimitError` check as the FIRST conditional in every catch block that calls `githubFetch()`.
**Warning signs:** Rate-limit scenarios return 500 instead of 429.

### Pitfall 5: Priority Enum Mismatch
**What goes wrong:** Using `'urgent'` (the existing `taskPriorities` enum value) instead of `'critical'` for triage priority.
**Why it happens:** The existing `taskPriorities` in `validation.ts` uses `'urgent'` as the top level; but D-09 specifies `'critical'|'high'|'medium'|'low'` for the triage table.
**How to avoid:** Triage uses a separate priority enum. Do NOT reuse `taskPriorities` from `validation.ts`.
**Warning signs:** Phase 4 triage UI or Phase 6 promotion receiving unexpected priority values.

## Code Examples

### GET /api/triage Route — Default Empty State

```typescript
// Source: [VERIFIED: codebase conventions + D-04 decision]
case 'GET': {
  const record = await getTriageRecord(repo, issueNumber);
  return res.json(record ?? {
    isTriaged: false,
    priority: null,
    githubCommentId: null,
    commentStatus: null,
  });
}
```

### PUT /api/triage Route — Upsert

```typescript
// Source: [VERIFIED: codebase conventions + D-05 decision]
case 'PUT': {
  const putSchema = z.object({
    isTriaged: z.boolean().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  });
  const bodyResult = putSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: 'Invalid input', details: bodyResult.error.flatten().fieldErrors });
  }
  const record = await upsertTriageRecord(repo, issueNumber, bodyResult.data);
  return res.json(record);
}
```

### Upsert SQL in `triage.ts`

```typescript
// Source: [VERIFIED: tasks.ts ON CONFLICT pattern]
await getClient().execute({
  sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
          is_triaged = COALESCE(excluded.is_triaged, is_triaged),
          priority = COALESCE(excluded.priority, priority),
          updated_at = datetime('now')`,
  args: [repo, issueNumber, isTriaged ? 1 : 0, priority ?? null],
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `Response` passthrough from `githubFetch()` | Throws `GitHubRateLimitError` with `retryAfter` | Phase 1 | Clients get actionable 429 with retry timing |
| No issue filter params on issues proxy | `labels` + `assignee` optional query params | Phase 1 | Enables Phase 2 UI filter features |
| No `issue_triage` table | `011_issue_triage` migration | Phase 1 | Enables Phase 4 triage state persistence |

**Deprecated/outdated:**
- Checking `response.status === 403` without header inspection: After this phase, `githubFetch()` handles 403 classification internally — callers no longer need to check.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel auto-discovers `api/triage/[owner]/[repo]/[number].ts` without a `vercel.json` rewrite | Architecture Patterns (Pattern 6) | Route 404s; need to add `rewrites` entry to `vercel.json` |
| A2 | `retry-after` header is present on all secondary rate-limit responses | Pattern 2 code | Secondary limits not caught; they pass through as generic errors |

**Confidence on A1:** HIGH — confirmed by existing `vercel.json` (no `functions` or `rewrites` for existing dynamic routes like `[owner]/[repo]/issues.ts`), and Vercel documentation on file-based routing.

**Confidence on A2:** MEDIUM — confirmed by GitHub docs which state "if a `retry-after` response header is present..." — the "if" implies it may not always be present. The fallback to 60 seconds in D-02 handles this case. [CITED: docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api]

## Open Questions

1. **`issues.ts` existing `catch` block**
   - What we know: Current catch at line 45 returns generic 500 for all errors.
   - What's unclear: Should the catch be updated in `issues.ts` specifically, or should `githubFetch()` be the only place that needs updating (since callers already re-throw)?
   - Recommendation: Since `githubFetch()` now throws `GitHubRateLimitError`, every route that calls it needs a typed catch. `issues.ts` must be updated. New triage routes should include it from the start.

2. **`COALESCE` vs. full-replace upsert**
   - What we know: PUT only accepts `{ isTriaged, priority }` per D-05; the PUT body is a partial update.
   - What's unclear: Should a PUT with `{ isTriaged: true }` (no priority) preserve the existing priority, or reset it?
   - Recommendation: Use `COALESCE(excluded.priority, priority)` to preserve existing value when field not sent. This is the least-surprising behavior for a partial-update PUT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vercel serverless functions | ✓ | (project standard) | — |
| Turso / libSQL | DB migrations + triage queries | ✓ | `@libsql/client ^0.14.0` | — |
| Zod | Schema validation | ✓ | `^3.24.4` | — |
| TypeScript | Type safety | ✓ | `^5.8.3` | — |

No missing dependencies. All required packages are already in `apps/web/package.json`. [VERIFIED: codebase]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.0` |
| Config file | `apps/web/vite.config.ts` (Vitest runs via Vite) |
| Quick run command | `cd apps/web && npx vitest run` |
| Full suite command | `cd apps/web && npx vitest run` |

**Note:** No `vitest.config.*` found and no `test` script in `apps/web/package.json`. Vitest is installed as a devDependency but no test files exist yet. Wave 0 must establish the test foundation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `GitHubRateLimitError` thrown on primary rate limit (429, 403 + remaining=0) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-01 | `GitHubRateLimitError` thrown on secondary rate limit (retry-after header) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-01 | `retryAfter` derived from `x-ratelimit-reset` (primary) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-01 | `retryAfter` derived from `retry-after` (secondary) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-01 | `retryAfter` falls back to 60 when both headers absent | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-01 | Non-rate-limit 403 (e.g., auth failure) not thrown as `GitHubRateLimitError` | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ Wave 0 |
| INFRA-02 | `getTriageRecord()` returns `null` when no record | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ Wave 0 |
| INFRA-02 | `upsertTriageRecord()` creates new record | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ Wave 0 |
| INFRA-02 | `upsertTriageRecord()` updates existing record | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npx vitest run api/_lib/github.test.ts`
- **Per wave merge:** `cd apps/web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/api/_lib/github.test.ts` — unit tests for `GitHubRateLimitError` detection (covers INFRA-01)
- [ ] `apps/web/api/_lib/db/triage.test.ts` — unit tests for `getTriageRecord` and `upsertTriageRecord` (covers INFRA-02)
- [ ] `apps/web/vitest.config.ts` — configure Vitest for the `apps/web` workspace
- [ ] `apps/web/package.json` — add `"test": "vitest run"` and `"test:watch": "vitest"` scripts

**Note:** The DB helper tests will require mocking `@libsql/client` since tests run without a live Turso instance. A shared mock in `apps/web/api/_lib/db/__mocks__/client.ts` or using `vi.mock` inline is the recommended approach.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest()` from `middleware.ts` — JWT Bearer token on all triage routes |
| V3 Session Management | no | Stateless JWT; no session state |
| V4 Access Control | yes | Routes return 401 if no token; role not required beyond authenticated member |
| V5 Input Validation | yes | Zod schemas on all query params and request bodies |
| V6 Cryptography | no | No new cryptographic operations; JWT handled by existing `jwt.ts` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `owner`/`repo`/`number` params | Tampering | `encodeURIComponent()` on all GitHub URL segments (already used in existing routes) |
| Unvalidated priority values in PUT body | Tampering | Zod enum validation on priority field before DB write |
| Unauthenticated access to triage state | Spoofing | `authenticateRequest()` at top of handler; return early if null |
| Arbitrary `retryAfter` injection via crafted headers | Tampering | N/A — headers come from GitHub API response, not user input |
| Integer overflow on `github_issue_number` | Tampering | Zod `z.number().int().positive()` on issue number path param |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] — `apps/web/api/_lib/github.ts`, `client.ts`, `tasks.ts`, `middleware.ts`, `validation.ts`, `issues.ts`, `comment.ts`, `vercel.json`
- [CITED: docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api] — GitHub rate limit headers, primary vs secondary limit detection, `retry-after` header semantics

### Secondary (MEDIUM confidence)
- WebSearch: GitHub rate limit 403/429 header behavior — cross-verified against official GitHub docs

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in `package.json`
- Architecture: HIGH — all patterns verified against existing route implementations
- Rate-limit detection: HIGH — verified against official GitHub REST API docs
- Migration pattern: HIGH — verified against `client.ts` MIGRATIONS array
- Pitfalls: HIGH — derived from direct code analysis of existing implementations

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain — GitHub API headers, libSQL, Zod patterns are all stable)
