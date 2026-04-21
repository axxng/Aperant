# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 6 (4 modified, 2 new)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/api/_lib/github.ts` | utility | request-response | self (existing file being modified) | exact |
| `apps/web/api/_lib/validation.ts` | utility/config | transform | self (existing file being modified) | exact |
| `apps/web/api/_lib/db/client.ts` | config/migration | batch | self (existing file being modified) | exact |
| `apps/web/api/_lib/db/triage.ts` | service | CRUD | `apps/web/api/_lib/db/tasks.ts` | exact |
| `apps/web/api/triage/[owner]/[repo]/[number].ts` | route/controller | request-response | `apps/web/api/tasks/[id]/index.ts` | role-match |
| `apps/web/api/github/repos/[owner]/[repo]/issues.ts` | route/controller | request-response | self (existing file being modified) | exact |

---

## Pattern Assignments

### `apps/web/api/_lib/github.ts` (utility, request-response) — MODIFY

**Analog:** self — `apps/web/api/_lib/github.ts` (lines 1-25)

**Existing imports pattern** (lines 1-6):
```typescript
import { resolveConfig } from './config-resolver.js';
import type { GitHubPR, PRFile } from '../../src/shared/types/pr.js';

const GITHUB_API = 'https://api.github.com';
export { GITHUB_API };
```

**Existing `githubFetch()` core pattern** (lines 14-25):
```typescript
export async function githubFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getGitHubToken();
  return fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
}
```

**New `GitHubRateLimitError` class to add** (place before `githubFetch`, after imports):
```typescript
export class GitHubRateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`GitHub rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = 'GitHubRateLimitError';
    this.retryAfter = retryAfter;
  }
}
```

**Modified `githubFetch()` rate-limit detection block** (insert after `fetch()` call, before `return response`):
```typescript
// Primary rate limit: 429 or 403 with x-ratelimit-remaining = 0
// Secondary rate limit: 403/429 with retry-after header
const isRateLimitStatus = response.status === 429 || response.status === 403;
const remaining = response.headers.get('x-ratelimit-remaining');
const retryAfterHeader = response.headers.get('retry-after'); // secondary: seconds
const resetHeader = response.headers.get('x-ratelimit-reset'); // primary: unix timestamp

const isPrimaryLimit = isRateLimitStatus && remaining === '0';
const isSecondaryLimit = isRateLimitStatus && retryAfterHeader !== null;

if (isPrimaryLimit || isSecondaryLimit) {
  let retryAfter: number;
  if (retryAfterHeader !== null) {
    retryAfter = Math.max(0, parseInt(retryAfterHeader, 10));
  } else if (resetHeader !== null) {
    retryAfter = Math.max(0, Math.ceil(parseInt(resetHeader, 10) - Date.now() / 1000));
  } else {
    retryAfter = 60; // fallback per D-02
  }
  throw new GitHubRateLimitError(retryAfter);
}
```

---

### `apps/web/api/_lib/validation.ts` (utility/config, transform) — MODIFY

**Analog:** self — `apps/web/api/_lib/validation.ts` (lines 109-113)

**Existing `githubIssueQuerySchema`** (lines 109-113):
```typescript
export const githubIssueQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.string().regex(/^\d+$/).default('1'),
  per_page: z.string().regex(/^\d+$/).default('50'),
});
```

**Extended schema to replace it with** (add `labels` and `assignee` — non-breaking):
```typescript
export const githubIssueQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.string().regex(/^\d+$/).default('1'),
  per_page: z.string().regex(/^\d+$/).default('50'),
  labels: z.string().optional(),   // comma-separated, passed through as-is (D-11)
  assignee: z.string().optional(), // single login string (D-11)
});
```

---

### `apps/web/api/_lib/db/client.ts` (config/migration, batch) — MODIFY

**Analog:** self — `apps/web/api/_lib/db/client.ts` (lines 67-201)

**Migration array pattern** (append entry, following lines 188-200 as model):
```typescript
// Last two existing entries for reference:
{
  name: '009_github_sync_pending',
  sql: `
    ALTER TABLE tasks ADD COLUMN github_sync_pending INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_tasks_sync_pending ON tasks(github_sync_pending) WHERE github_sync_pending = 1;
  `,
},
{
  name: '010_github_sync_retry_count',
  sql: `
    ALTER TABLE tasks ADD COLUMN github_sync_retry_count INTEGER NOT NULL DEFAULT 0;
  `,
},
```

**New entry to append** (D-09, D-10):
```typescript
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

**How migrations run** (lines 27-49 of `client.ts` — no changes needed here, just context):
```typescript
async function runMigrations(c: Client): Promise<void> {
  // Creates migrations table if absent, reads applied set, runs unapplied
  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      await c.executeMultiple(migration.sql);
      await c.execute({ sql: 'INSERT INTO migrations (name) VALUES (?)', args: [migration.name] });
    }
  }
}
```

---

### `apps/web/api/_lib/db/triage.ts` (service, CRUD) — NEW

**Analog:** `apps/web/api/_lib/db/tasks.ts`

**Imports pattern** (tasks.ts lines 1-3 as model):
```typescript
import { getClient } from './client.js';
// No uuid — composite PK; no external type file yet; define inline
```

**Row-mapper helper pattern** (tasks.ts lines 152-175 as model):
```typescript
function rowToTriage(row: any): TriageRecord {
  return {
    githubRepo: row.github_repo as string,
    githubIssueNumber: Number(row.github_issue_number),
    isTriaged: row.is_triaged === 1,
    priority: (row.priority as TriageRecord['priority']) || null,
    githubCommentId: row.github_comment_id ? Number(row.github_comment_id) : null,
    commentStatus: (row.comment_status as TriageRecord['commentStatus']) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

**getByKey helper pattern** (tasks.ts lines 27-34 as model):
```typescript
export async function getTriageRecord(repo: string, issueNumber: number): Promise<TriageRecord | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM issue_triage WHERE github_repo = ? AND github_issue_number = ?',
    args: [repo, issueNumber],
  });
  const row = result.rows[0];
  return row ? rowToTriage(row) : null;
}
```

**ON CONFLICT upsert pattern** (tasks.ts lines 144-150 as direct model for `setTaskOrder`):
```typescript
// setTaskOrder uses ON CONFLICT(...) DO UPDATE SET — same pattern for upsertTriageRecord:
await getClient().execute({
  sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
          is_triaged = COALESCE(excluded.is_triaged, is_triaged),
          priority = COALESCE(excluded.priority, priority),
          updated_at = datetime('now')`,
  args: [repo, issueNumber, isTriaged !== undefined ? (isTriaged ? 1 : 0) : null, priority ?? null],
});
```

**Interface to define in this file** (D-09 schema):
```typescript
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
```

---

### `apps/web/api/triage/[owner]/[repo]/[number].ts` (route/controller, request-response) — NEW

**Analog:** `apps/web/api/tasks/[id]/index.ts`

**Imports pattern** (tasks/[id]/index.ts lines 1-7 as model — adapt relative paths for deeper nesting):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest } from '../../../_lib/auth/middleware.js';
import { getTriageRecord, upsertTriageRecord } from '../../../_lib/db/triage.js';
import { GitHubRateLimitError } from '../../../_lib/github.js';
import { z } from 'zod';
```

**Handler top pattern** (tasks/[id]/index.ts lines 9-14 as model):
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  const user = await authenticateRequest(req, res);
  if (!user) return;

  const owner = req.query.owner as string;
  const repo = req.query.repo as string;
  const repoFull = `${owner}/${repo}`;
  const issueNumber = parseInt(req.query.number as string, 10);
```

**switch(req.method) pattern** (tasks/[id]/index.ts lines 24-79 as direct model):
```typescript
  switch (req.method) {
    case 'GET': {
      // D-04: always 200, default empty state if no record
      const record = await getTriageRecord(repoFull, issueNumber);
      return res.json(record ?? {
        isTriaged: false,
        priority: null,
        githubCommentId: null,
        commentStatus: null,
      });
    }

    case 'PUT': {
      const putSchema = z.object({
        isTriaged: z.boolean().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
      });
      const bodyResult = putSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({ error: 'Invalid input', details: bodyResult.error.flatten().fieldErrors });
      }
      const record = await upsertTriageRecord(repoFull, issueNumber, bodyResult.data);
      return res.json(record);
    }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
```

**Error handling pattern with GitHubRateLimitError** (pattern from comment.ts lines 37-39 + RESEARCH.md Pattern 3):
```typescript
  } catch (error: any) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
```

**Path param validation pattern** (validation.ts lines 129-138 as model — use `githubOwnerRepoSchema`):
```typescript
// Validate owner/repo params against existing schema
import { githubOwnerRepoSchema } from '../../../_lib/validation.js';
const pathResult = githubOwnerRepoSchema.extend({
  number: z.string().regex(/^\d+$/),
}).safeParse({ owner: req.query.owner, repo: req.query.repo, number: req.query.number });
if (!pathResult.success) {
  return res.status(400).json({ error: 'Invalid path parameters' });
}
```

---

### `apps/web/api/github/repos/[owner]/[repo]/issues.ts` (route/controller, request-response) — MODIFY

**Analog:** self — `apps/web/api/github/repos/[owner]/[repo]/issues.ts` (full file)

**Existing destructure** (line 26):
```typescript
const { state, page, per_page } = queryResult.data;
```

**Modified destructure** (add `labels`, `assignee`):
```typescript
const { state, page, per_page, labels, assignee } = queryResult.data;
```

**Existing params construction** (line 27):
```typescript
const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });
```

**Modified params construction** (add conditional appends after URLSearchParams):
```typescript
const params = new URLSearchParams({ state, page, per_page, sort: 'updated', direction: 'desc' });
if (labels) params.set('labels', labels);
if (assignee) params.set('assignee', assignee);
```

**Error handling update** — the existing catch at line 45-47 catches all errors as 500. Add `GitHubRateLimitError` check first:
```typescript
  } catch (error: any) {
    if (error instanceof GitHubRateLimitError) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
```

---

## Shared Patterns

### Authentication
**Source:** `apps/web/api/_lib/auth/middleware.ts` lines 11-28
**Apply to:** `triage/[owner]/[repo]/[number].ts` (new) — already used in all other routes
```typescript
// Call at top of handler AFTER ensureDb(); return early if null
const user = await authenticateRequest(req, res);
if (!user) return;
```

### Error Handling (generic)
**Source:** `apps/web/api/tasks/[id]/index.ts` — no try/catch (errors propagate); `comment.ts` lines 37-39
**Apply to:** All route handlers that call `githubFetch()` — add `instanceof GitHubRateLimitError` as FIRST branch
```typescript
} catch (error: any) {
  if (error instanceof GitHubRateLimitError) {
    return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
  }
  res.status(500).json({ error: 'Internal server error' });
}
```

### Validation (Zod safeParse)
**Source:** `apps/web/api/tasks/[id]/index.ts` lines 31-35; `apps/web/api/github/repos/[owner]/[repo]/issues.ts` lines 21-24
**Apply to:** All query-param and request-body validation in new/modified routes
```typescript
const result = schema.safeParse(req.body /* or req.query */);
if (!result.success) {
  return res.status(400).json({ error: 'Invalid input', details: result.error.flatten().fieldErrors });
}
```

### DB Helper Pattern (row mapper + typed interface)
**Source:** `apps/web/api/_lib/db/tasks.ts` lines 152-175 (`rowToTask`) and lines 1-3 (imports)
**Apply to:** `apps/web/api/_lib/db/triage.ts`
- Define TypeScript interface alongside the module (no separate type file needed)
- Implement a `rowToTriage()` mapper converting SQLite row types (`INTEGER` → `boolean`, etc.)
- Never inline SQL in route handlers — all SQL lives in `_lib/db/triage.ts`

### ON CONFLICT Upsert Pattern
**Source:** `apps/web/api/_lib/db/tasks.ts` lines 144-150 (`setTaskOrder`)
**Apply to:** `upsertTriageRecord()` in `triage.ts`
```typescript
// ON CONFLICT(pk_cols) DO UPDATE SET ... updated_at = datetime('now')
// COALESCE(excluded.field, field) preserves existing value when field not in payload
```

### Method Routing (switch)
**Source:** `apps/web/api/tasks/[id]/index.ts` lines 24-79
**Apply to:** `apps/web/api/triage/[owner]/[repo]/[number].ts`
```typescript
switch (req.method) {
  case 'GET': { ... }
  case 'PUT': { ... }
  default:
    return res.status(405).json({ error: 'Method not allowed' });
}
```

### Relative Import Path Depth
**Source:** `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` lines 1-5 (6 levels deep uses `../../../../../../`)
**Apply to:** `apps/web/api/triage/[owner]/[repo]/[number].ts` (4 levels deep uses `../../../`)
```typescript
// api/triage/[owner]/[repo]/[number].ts → _lib is 3 levels up
import { ensureDb } from '../../../_lib/db/client.js';
import { authenticateRequest } from '../../../_lib/auth/middleware.js';
```

---

## No Analog Found

All files in Phase 1 have direct analogs in the codebase. No new patterns need to be sourced from RESEARCH.md.

---

## Metadata

**Analog search scope:** `apps/web/api/` (all route and library files)
**Files scanned:** 9 (github.ts, client.ts, middleware.ts, validation.ts, tasks.ts, issues.ts, comment.ts, tasks/[id]/index.ts, plus glob listing)
**Pattern extraction date:** 2026-04-21
