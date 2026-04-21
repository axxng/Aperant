---
phase: 01-foundation
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/web/api/_lib/github.test.ts
  - apps/web/api/_lib/github.ts
  - apps/web/vite.config.ts
  - apps/web/package.json
  - apps/web/api/_lib/db/triage.ts
  - apps/web/api/_lib/db/triage.test.ts
  - apps/web/api/_lib/db/client.ts
  - apps/web/api/triage/[owner]/[repo]/[number].ts
  - apps/web/api/_lib/validation.ts
  - apps/web/api/github/repos/[owner]/[repo]/issues.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 01 foundation layer: GitHub API client, DB client/migrations, triage data layer, two API route handlers, and the validation schema library. The code is well-structured overall with good Zod validation patterns and correct rate-limit detection logic in `githubFetch`.

Two areas need attention before shipping:

1. **Silent `null` clear bug in triage upsert** — the API contract advertises `priority: null` as an explicit clear, but the COALESCE-based SQL will silently ignore it and preserve the old value. This is a logic correctness issue.
2. **Unvalidated path parameters in the issues route** — `owner`/`repo` are cast with `as string` without running them through the existing `githubOwnerRepoSchema`, bypassing the injection-guard regex that exists for exactly this purpose.

The remaining warnings cover silent error swallowing (no logging on 500s), a missing-env-var footgun in the DB client, and a data-integrity gap from non-sequential migration names.

---

## Critical Issues

_(none at Critical severity — the two most serious issues are classified Warning because they are logic correctness bugs rather than direct injection vectors, given the auth middleware wrapping all routes)_

---

## Warnings

### WR-01: Explicit `priority: null` clear is silently ignored by COALESCE upsert

**File:** `apps/web/api/_lib/db/triage.ts:46-54`

**Issue:** The `triagePutBodySchema` (in `[number].ts`) accepts `priority: null` as a valid value signalling "clear this field". However, the upsert SQL uses `COALESCE(excluded.priority, priority)`. When the caller passes `priority: null`, the `args` array sends SQL `NULL` for `excluded.priority`, causing COALESCE to fall back to the existing column value rather than clearing it. The field can never be cleared once set via this API.

**Fix:**
```typescript
// In upsertTriageRecord, detect an explicit null clear and use a conditional update
// instead of a single COALESCE expression.

export async function upsertTriageRecord(
  repo: string,
  issueNumber: number,
  updates: { isTriaged?: boolean; priority?: 'critical' | 'high' | 'medium' | 'low' | null }
): Promise<TriageRecord> {
  const isTriagedVal = updates.isTriaged !== undefined ? (updates.isTriaged ? 1 : 0) : null;
  // Distinguish "not provided" (undefined) from "explicit clear" (null)
  const priorityProvided = 'priority' in updates;
  const priorityVal = priorityProvided ? (updates.priority ?? null) : undefined;

  await getClient().execute({
    sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
            is_triaged = CASE WHEN ? IS NOT NULL THEN ? ELSE is_triaged END,
            priority   = CASE WHEN ? THEN ? ELSE priority END,
            updated_at = datetime('now')`,
    args: [
      repo, issueNumber,
      isTriagedVal, priorityProvided ? priorityVal : null,
      // CASE args for is_triaged
      isTriagedVal, isTriagedVal,
      // CASE args for priority: use a separate sentinel bool column or pass a flag
      priorityProvided ? 1 : 0, priorityVal,
    ],
  });

  const record = await getTriageRecord(repo, issueNumber);
  return record!;
}
```

Alternatively, build the UPDATE SET clause dynamically based on which keys are present in `updates`, which avoids the COALESCE problem entirely and is cleaner:

```typescript
// Dynamic partial-update approach (cleaner):
const setClauses: string[] = ['updated_at = datetime(\'now\')'];
const args: unknown[] = [];

if (updates.isTriaged !== undefined) {
  setClauses.push('is_triaged = ?');
  args.push(updates.isTriaged ? 1 : 0);
}
if ('priority' in updates) {
  setClauses.push('priority = ?');
  args.push(updates.priority ?? null);
}

await getClient().execute({
  sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
          ${setClauses.join(', ')}`,
  args: [repo, issueNumber,
         updates.isTriaged !== undefined ? (updates.isTriaged ? 1 : 0) : 0,
         'priority' in updates ? (updates.priority ?? null) : null,
         ...args],
});
```

---

### WR-02: `owner` and `repo` path params used without validation in issues route

**File:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts:18-19`

**Issue:** `owner` and `repo` are extracted with a bare `as string` cast and passed directly to `encodeURIComponent` without running through `githubOwnerRepoSchema`. The existing schema enforces `/^[a-zA-Z0-9_.-]+$/` exactly to prevent path traversal (e.g., `../` segments, `%2F`-encoded slashes). Since `encodeURIComponent` will encode most special characters, direct injection is mitigated, but the validation layer is intentionally bypassed, breaking defence-in-depth.

**Fix:**
```typescript
// Replace lines 18-19 with a schema parse, consistent with the triage handler:
const pathResult = githubOwnerRepoSchema.safeParse({
  owner: req.query.owner,
  repo: req.query.repo,
});
if (!pathResult.success) {
  return res.status(400).json({ error: 'Invalid path parameters', details: pathResult.error.flatten().fieldErrors });
}
const { owner, repo } = pathResult.data;
// Import githubOwnerRepoSchema at the top of the file
```

---

### WR-03: `githubGraphQL` bypasses rate-limit detection and has no HTTP error guard

**File:** `apps/web/api/_lib/github.ts:66-80`

**Issue:** `githubGraphQL` calls `fetch` directly (not `githubFetch`), so it receives no rate-limit detection. If GitHub returns 429 or a secondary rate limit on GraphQL, the function will try to parse the error body as JSON and may surface a confusing `GraphQL error:` message instead of a `GitHubRateLimitError`. Additionally, if the HTTP response is non-2xx (e.g., 401, 500), `response.json()` is called unconditionally — the body may not be JSON, causing an unhandled parse error.

**Fix:**
```typescript
export async function githubGraphQL(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  // Use githubFetch to get rate-limit detection on GraphQL too
  const response = await githubFetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { data?: unknown; errors?: { message: string }[] };
  if (data.errors?.length) {
    throw new Error(`GraphQL error: ${data.errors.map(e => e.message).join(', ')}`);
  }
  return data.data;
}
```

---

### WR-04: `TURSO_DATABASE_URL` missing env var produces cryptic runtime error

**File:** `apps/web/api/_lib/db/client.ts:9`

**Issue:** `process.env.TURSO_DATABASE_URL!` uses a non-null assertion. If the env var is absent (common in local dev or misconfigured deployments), `createClient` receives `undefined` (cast to string by `!`), fails with an internal `@libsql/client` error that does not mention the missing variable, making the root cause hard to diagnose.

**Fix:**
```typescript
export function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error('Missing required environment variable: TURSO_DATABASE_URL');
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}
```

---

### WR-05: Errors silently swallowed in both API route catch blocks

**File:** `apps/web/api/triage/[owner]/[repo]/[number].ts:71-73`
**File:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts:47-51`

**Issue:** Both catch blocks respond with `500 Internal Server Error` but discard the error object entirely with no logging. In a serverless environment, this makes production failures completely invisible — there is no way to distinguish a DB failure from a GitHub API failure from a programming error.

Per CLAUDE.md, `console.log` is invisible in production Electron builds, but this is a web API (Vercel functions) where `console.error` is captured by Vercel's logging infrastructure.

**Fix:**
```typescript
// triage handler, line 71:
} catch (error: unknown) {
  console.error('[triage] Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

// issues handler, line 47:
} catch (error: unknown) {
  if (error instanceof GitHubRateLimitError) {
    return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
  }
  console.error('[issues] Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

---

## Info

### IN-01: Non-sequential migration names suggest missing migrations

**File:** `apps/web/api/_lib/db/client.ts:67-216`

**Issue:** The MIGRATIONS array jumps from `001_initial_schema` to `006_users`, skipping `002` through `005`. If these were intentionally removed or never existed, the gap is harmless. But if they were deleted from the array after already being applied in some environments, those environments could have schema state that the current code does not reflect. Worth a comment clarifying the intent.

**Fix:** Add a comment at the top of the MIGRATIONS array explaining that `002–005` were squashed into `001`, or restore the correct numbering sequence.

---

### IN-02: `console.log` used in production DB code

**File:** `apps/web/api/_lib/db/client.ts:46`, `apps/web/api/_lib/db/client.ts:64`

**Issue:** Two `console.log` calls for migration and admin bootstrap output. In Vercel serverless functions these do surface in logs, but the project CLAUDE.md forbids `console.log` in production code in favour of a proper logger. For server-side code in this repo, `console.error`/`console.info` at minimum, or a structured logger.

**Fix:** Replace with `console.info` for operational messages, or adopt a structured logging pattern consistent with the rest of the codebase.

---

### IN-03: `githubFetch` test spy not explicitly restored

**File:** `apps/web/api/_lib/github.test.ts:30`

**Issue:** `vi.spyOn(globalThis, 'fetch')` is set up in `beforeEach` but there is no `afterEach(() => vi.restoreAllMocks())`. Vitest does not auto-restore spies by default unless `restoreMocks: true` is set in the config. The tests pass because each test uses `mockResolvedValueOnce`, but if test isolation is ever needed (e.g., running in a shared suite), this spy leak could cause unexpected behaviour.

**Fix:**
```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```
Or add `restoreMocks: true` to the `test` block in `vite.config.ts`.

---

### IN-04: `mapGitHubPR` / `mapGitHubIssue` / `githubGraphQL` use untyped `any`

**File:** `apps/web/api/_lib/github.ts:66`, `84`, `106`

**Issue:** Three exported functions accept or return `any`. Given the project uses TypeScript strict mode, these are type-safety gaps that defeat the benefit of the PR/Issue type definitions they map to.

**Fix:** Type the raw API response parameters with an `interface RawGitHubPR` / `interface RawGitHubIssue`, and return `Promise<unknown>` from `githubGraphQL` (callers can narrow). At minimum, change `Record<string, any>` to `Record<string, unknown>` in `githubGraphQL`.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
