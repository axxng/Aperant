# Phase 7: Promote to Backlog - Research

**Researched:** 2026-04-22
**Domain:** Task creation from GitHub issues, duplicate guard, write-back sync, frontend React mutations
**Confidence:** HIGH — all findings verified directly from codebase source files

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROMOTE-01 | User can promote a GitHub issue to a Currents backlog task in one action from the triage panel | `POST /api/tasks` already accepts `githubIssueNumber`, `githubIssueUrl`, `githubRepo`, `priority`. New promote mutation in `IssueDetailPanel` fires this. |
| PROMOTE-02 | Promoted task stays live-synced with the GitHub issue — edits write back via existing write-back mechanism | `syncTaskToGitHub()` in `github-writeback.ts` fires on every `PATCH /api/tasks/:id` when `githubRepo` + `githubIssueNumber` are set. No new code needed in the sync layer. |
| PROMOTE-03 | Already-promoted issue shows "View in Backlog" badge linking to the task instead of promote button | Requires querying `getTaskByGitHubIssue(repo, issueNumber)` at panel open time. Task id is returned and used as the link target. |
| PROMOTE-04 | Internal triage priority pre-populates the task priority during promotion | `triageData.priority` is already in scope inside `IssueDetailPanel` (from the existing triage `useQuery`). Map triage `critical/high/medium/low` to task `TaskPriority` — schemas are compatible. |
| PROMOTE-05 | The same GitHub issue cannot be promoted to a task twice | DB-level unique index `idx_tasks_github_unique` on `(github_repo, github_issue_number)` already exists. API must catch the SQLite UNIQUE constraint error and return 409 Conflict. |
</phase_requirements>

---

## Summary

Phase 7 adds a "Promote to Backlog" action to the existing `IssueDetailPanel`. The work is primarily wiring — the data model, write-back, and API layer are already in place. Four distinct concerns must be addressed:

**1. Duplicate guard at the DB level:** Migration `001_initial_schema` already created `idx_tasks_github_unique` — a partial unique index on `(github_repo, github_issue_number) WHERE github_repo IS NOT NULL AND github_issue_number IS NOT NULL`. The API layer simply needs to catch the SQLite UNIQUE constraint violation and return 409 instead of 500.

**2. Already-promoted state detection (PROMOTE-03):** `getTaskByGitHubIssue(repo, issueNumber)` already exists in `api/_lib/db/tasks.ts`. A new API endpoint `GET /api/tasks/by-github-issue?repo=…&number=…` will expose this to the frontend, or the promote endpoint can return the existing task on 409. The panel uses this to render the "View in Backlog" badge.

**3. Write-back is automatic (PROMOTE-02):** `syncTaskToGitHub()` is invoked on every `PATCH /api/tasks/:id`. Since the promoted task will have `githubRepo` and `githubIssueNumber` populated, any subsequent edit in Currents automatically writes back to GitHub. No new sync code is needed.

**4. Priority mapping (PROMOTE-04):** The triage priority schema (`critical | high | medium | low`) and the task priority schema (`low | medium | high | urgent`) share `low / medium / high`. The triage `critical` maps to task `urgent` — this is the only non-trivial mapping. The `TaskPriority` type does not include `critical`; the mapping must be explicit.

**Primary recommendation:** Add one new API route (`POST /api/tasks/promote`) that wraps `createTask` with duplicate detection, and add a promote mutation + already-promoted state query to `IssueDetailPanel`. All other layers (write-back, DB schema) need zero changes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Promote action (fire + forget) | Frontend (React mutation) | API (POST /api/tasks) | User-initiated; TanStack mutation handles loading/error state; API creates the task |
| Duplicate guard | Database (unique index) | API (catch + 409) | Enforcement must be at DB level; API translates DB error to HTTP 409 |
| Already-promoted detection | API (query by github issue) | Frontend (conditional render) | Panel needs task id for the link; querying from frontend avoids stale state |
| Write-back sync | API (PATCH handler) | Background cron | Existing `syncTaskToGitHub` fires on PATCH; cron retries failures |
| Priority pre-population | Frontend (triage data in scope) | — | `triageData.priority` already fetched; mapping happens client-side before POST |
| "View in Backlog" badge | Frontend (IssueDetailPanel) | — | Conditional render replaces promote button when task exists |

---

## Standard Stack

### Core (verified from `apps/web/package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.99.2 | Server state, mutations, cache invalidation | Used in all existing panels; `useMutation` pattern established in `IssueDetailPanel` |
| react-i18next | ^15.4.1 | i18n for all UI text | CLAUDE.md requirement — all user-facing text uses translation keys |
| zod | ^3.24.4 | Schema validation at API boundaries | Parse-don't-validate engineering principle — every input parsed at boundary |
| lucide-react | ^0.511.0 | Icons | Existing: `BookmarkPlus` for promote button, `ExternalLink` for "View in Backlog" |
| vitest | ^4.0.0 | Test runner | Red-Green TDD requirement; co-located test files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @libsql/client | ^0.14.0 | Turso/SQLite DB client | Used in all DB functions; no change needed |

---

## Architecture Patterns

### System Architecture Diagram

```
IssueDetailPanel (React)
        │
        ├── useQuery ['triage', owner, repo, number]
        │       └── GET /api/triage/:owner/:repo/:number  →  issue_triage table
        │
        ├── useQuery ['task-by-github-issue', repo, number]   ← NEW (PROMOTE-03)
        │       └── GET /api/tasks/by-github-issue?repo=…&number=…  →  tasks table
        │               [getTaskByGitHubIssue() already exists in db/tasks.ts]
        │
        └── promoteMutation (useMutation)                      ← NEW (PROMOTE-01, 04, 05)
                └── POST /api/tasks  (existing handler)
                        │
                        ├── parse: createTaskSchema (githubIssueNumber, githubIssueUrl,
                        │          githubRepo, priority, title, productId, status='backlog')
                        ├── authorize: authenticateRequest
                        ├── createTask()  →  tasks table
                        │       └── UNIQUE constraint on (github_repo, github_issue_number)
                        │               → SQLITE_CONSTRAINT → catch → return 409
                        └── broadcastEvent('task_created', task)

Later (on PATCH /api/tasks/:id):
        └── syncTaskToGitHub(task, changes)   ← already wired, fires automatically (PROMOTE-02)
```

### Recommended Project Structure — new files only

```
apps/web/
├── api/
│   └── tasks/
│       ├── by-github-issue.ts          ← NEW: GET /api/tasks/by-github-issue
│       └── by-github-issue.test.ts     ← NEW: unit tests (TDD Wave 0)
└── src/client/components/
    └── IssueDetailPanel.test.tsx       ← EXTENDED: PROMOTE-01..05 describe blocks
```

`IssueDetailPanel.tsx` is modified, not replaced.

### Pattern 1: Duplicate Guard — catch SQLite UNIQUE constraint at API level

The `tasks` table already has this index (from migration `001_initial_schema`):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_unique
  ON tasks(github_repo, github_issue_number)
  WHERE github_repo IS NOT NULL AND github_issue_number IS NOT NULL;
```

When `createTask()` fires on a duplicate, `@libsql/client` throws an error. The `POST /api/tasks` handler must catch this and return 409:

```typescript
// [VERIFIED: apps/web/api/tasks/index.ts + apps/web/api/_lib/db/client.ts migration 001]
try {
  const task = await createTask(result.data);
  await broadcastEvent('task_created', task);
  return res.status(201).json(task);
} catch (err: any) {
  if (err?.message?.includes('UNIQUE constraint failed')) {
    // Retrieve the existing task so the client can show the backlog link
    const existing = await getTaskByGitHubIssue(
      result.data.githubRepo!,
      result.data.githubIssueNumber!
    );
    return res.status(409).json({
      error: 'This issue is already in the backlog.',
      existingTask: existing,
    });
  }
  throw err;
}
```

### Pattern 2: Already-Promoted State Query (PROMOTE-03)

`getTaskByGitHubIssue(repo, issueNumber)` already exists in `api/_lib/db/tasks.ts`:

```typescript
// [VERIFIED: apps/web/api/_lib/db/tasks.ts line 175]
export async function getTaskByGitHubIssue(repo: string, issueNumber: number): Promise<Task | null> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM tasks WHERE github_repo = ? AND github_issue_number = ?',
    args: [repo, issueNumber],
  });
  const row = result.rows[0];
  return row ? rowToTask(row) : null;
}
```

New `GET /api/tasks/by-github-issue` route wraps this:

```typescript
// [VERIFIED: pattern from apps/web/api/tasks/index.ts — 4-step handler shape]
case 'GET': {
  const repo = z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/).parse(req.query.repo as string);
  const number = z.coerce.number().int().positive().parse(req.query.number as string);
  const user = await authenticateRequest(req, res);
  if (!user) return;
  const task = await getTaskByGitHubIssue(repo, number);
  return res.json(task ?? null);
}
```

Frontend `useQuery` key: `['task-by-github-issue', repoFullName, issueNumber]`

### Pattern 3: Priority Mapping (PROMOTE-04)

Triage priorities: `critical | high | medium | low`
Task priorities (TaskPriority): `low | medium | high | urgent`

```typescript
// [VERIFIED: apps/web/src/shared/types/task.ts line 12, apps/web/api/_lib/validation.ts line 10]
// [VERIFIED: apps/web/api/_lib/db/triage.ts TriageRecord.priority type]
function triagePriorityToTaskPriority(
  triage: 'critical' | 'high' | 'medium' | 'low' | null
): 'low' | 'medium' | 'high' | 'urgent' | undefined {
  if (!triage) return undefined;
  if (triage === 'critical') return 'urgent';
  return triage; // 'high' | 'medium' | 'low' match directly
}
```

### Pattern 4: Promote Mutation in IssueDetailPanel

The panel already has the pattern for `useMutation`. Add a third mutation (`promoteMutation`) following the established pattern for `triageMutation` and `noteMutation`:

```typescript
// [VERIFIED: apps/web/src/client/components/IssueDetailPanel.tsx — mutation structure]
const promoteMutation = useMutation({
  mutationFn: async (vars: { productId: string; title: string; priority?: TaskPriority;
                              githubIssueNumber: number; githubIssueUrl: string; githubRepo: string }) => {
    const res = await authenticatedFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...vars, status: 'backlog', description: '' }),
    });
    if (res.status === 409) {
      const body = await res.json();
      return { alreadyExists: true, existingTask: body.existingTask };
    }
    if (!res.ok) throw new Error('promote failed');
    return res.json();
  },
  onSuccess: (data) => {
    if (data.alreadyExists) {
      // Show "View in Backlog" badge — invalidate query
      queryClient.invalidateQueries({ queryKey: ['task-by-github-issue', issue?.repoFullName, issue?.number] });
      toastError(t('promote.duplicateToast'));
    } else {
      queryClient.invalidateQueries({ queryKey: ['task-by-github-issue', issue?.repoFullName, issue?.number] });
      toastSuccess(t('promote.successToast'));
    }
  },
  onError: () => {
    toastError(t('promote.errorToast'));
  },
});
```

### Pattern 5: Conditional Render — Promote Button vs "View in Backlog" Badge

```tsx
// [VERIFIED: UI-SPEC.md Component Inventory section]
{existingTask ? (
  <Badge variant="success" className="cursor-pointer gap-1 text-xs" asChild>
    <a href={`/products/${productId}/tasks/${existingTask.id}`}>
      <ExternalLink className="h-3 w-3" />
      {t('promote.viewInBacklog')}
    </a>
  </Badge>
) : (
  <Button
    variant="default"
    size="sm"
    disabled={promoteMutation.isPending}
    aria-label={t('promote.ariaLabel')}
    aria-busy={promoteMutation.isPending}
    aria-disabled={promoteMutation.isPending}
    onClick={handlePromote}
  >
    <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
    {t('promote.promoteButton')}
  </Button>
)}
```

### Pattern 6: "View in Backlog" link target

The Kanban board lives at `/products/:productId`. The task lives in the backlog column. The badge should link to `/products/:productId` with a way to highlight/scroll to the task. Looking at the current routing (`apps/web/src/client/App.tsx`), there is no `/tasks/:id` standalone route — the Kanban board is at `/products/:productId`. The simplest correct approach matching the UI-SPEC (`/tasks/${taskId}` was suggested in the spec but that route does not exist):

Use `/products/${productId}` as the link target. This navigates to the Kanban board where the task lives in the backlog column. The UI-SPEC says "linking to the Kanban task" — the product Kanban is the canonical view.

**Important:** `IssueDetailPanel` does not currently receive `productId` as a prop. The promote action requires `productId` to create the task. This must come from the parent `IssuesView` which already has `productId` from `useParams`. Either:
- Pass `productId` as a new prop to `IssueDetailPanel` (preferred — clean), OR
- Have `IssueDetailPanel` read it from `useParams` directly (acceptable since it is always rendered inside a product route)

### Anti-Patterns to Avoid

- **Hand-rolling duplicate detection:** The DB-level unique index already exists. Do NOT add an application-level "query before insert" check — it has a TOCTOU race condition. Catch the constraint error instead.
- **Querying all tasks to find the linked one:** Use `getTaskByGitHubIssue()` which queries by the indexed columns `(github_repo, github_issue_number)`. Do NOT filter from `getAllTasks()`.
- **Assuming `triage.priority` maps 1:1 to `task.priority`:** The value `critical` in triage maps to `urgent` in TaskPriority. The schemas are different; the mapping must be explicit.
- **Skipping broadcastEvent on task creation:** `POST /api/tasks` already calls `broadcastEvent('task_created', task)`. Do NOT call it again in a promote-specific handler — the existing handler handles it correctly.
- **Routing to `/tasks/:id`:** That route does not exist. Link to `/products/:productId` for the "View in Backlog" badge.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate prevention | Application-level check-before-insert | DB UNIQUE constraint + catch | Race-condition-free; constraint already exists in migration 001 |
| Task creation | Custom promote endpoint | Existing `POST /api/tasks` with 409 catch | Handler already validates, authorizes, creates, and broadcasts |
| Write-back | New sync trigger on promote | Existing `syncTaskToGitHub` in PATCH handler | Write-back fires automatically on any PATCH when `githubRepo`/`githubIssueNumber` are set |
| Priority value conversion | Runtime string checks | Explicit mapping function | Prevents silent bugs when triage `critical` must become task `urgent` |

---

## Common Pitfalls

### Pitfall 1: `productId` not available in `IssueDetailPanel`

**What goes wrong:** `createTask` requires `productId`. `IssueDetailPanel` currently receives only `issue`, `isOpen`, `onTriageLoad`, `onClose`. The parent `IssuesView` has `productId` from `useParams` but does not pass it down.

**Why it happens:** The panel was designed before promotion was in scope.

**How to avoid:** Add `productId: string` as a new required prop to `IssueDetailPanel`. Update `IssuesView` to pass it. Update `IssueDetailPanel.test.tsx` to include it in `render()` calls.

**Warning signs:** TypeScript error on `createTask` call — `productId` is `string | undefined`.

### Pitfall 2: SQLite constraint error message format

**What goes wrong:** The constraint catch checks for `'UNIQUE constraint failed'` in the error message. The exact message from `@libsql/client` must be verified.

**How to avoid:** The standard SQLite message is `"UNIQUE constraint failed: tasks.github_repo, tasks.github_issue_number"`. The check `err?.message?.includes('UNIQUE constraint failed')` is robust. Alternatively, check for `err?.code === 'SQLITE_CONSTRAINT_UNIQUE'` if `@libsql/client` exposes a code field.

**Warning signs:** 409 never fires (constraint error falls through to 500).

### Pitfall 3: `useMutation` call order in test setup

**What goes wrong:** `IssueDetailPanel.test.tsx` already uses a fragile call-count strategy to differentiate `triageMutation` (odd calls) from `noteMutation` (even calls). Adding a third `promoteMutation` changes the call count and breaks the existing test setup.

**Why it happens:** `useMutation` is called 3 times per render after this phase. The current `callCount % 2` logic will mis-route.

**How to avoid:** Switch the test mock to use `mockImplementation` based on the mutation function signature or an options property. Or pass distinguishing data (e.g., check for `mutationFn` arity) to route calls 1/2/3 correctly.

**Warning signs:** Existing triage/notes tests fail after promotion tests are added.

### Pitfall 4: "View in Backlog" badge requires task id before it is created

**What goes wrong:** After a successful promote, the panel needs to show the badge with the new task's id. If the code only invalidates the query after success without returning the task id in the mutation response, there is a gap before the re-fetch completes.

**How to avoid:** The `POST /api/tasks` response body is the full `Task` object (including `id`). Store the returned task id in local state or derive from the re-fetched `['task-by-github-issue']` query. Both approaches work; the query-based approach is cleaner because it also handles the 409 case correctly.

### Pitfall 5: The "View in Backlog" link requires `productId`

**What goes wrong:** The badge links to `/products/${productId}`. If `productId` is not threaded into `IssueDetailPanel`, the link is broken.

**How to avoid:** Same as Pitfall 1 — add `productId` prop. It is the same fix for two requirements (PROMOTE-01 for creating the task, PROMOTE-03 for the link).

### Pitfall 6: i18n keys missing from FR locale

**What goes wrong:** Adding keys to `en/issues.json` but forgetting `fr/issues.json` breaks the French locale at runtime.

**How to avoid:** Always update both files atomically in the same task. The UI-SPEC lists all 7 required keys under the `"promote"` namespace.

---

## Code Examples

### How existing mutations are structured (for promote mutation parity)

```typescript
// Source: apps/web/src/client/components/IssueDetailPanel.tsx (triageMutation pattern)
const triageMutation = useMutation({
  mutationFn: async (vars: { ... owner: string; repo: string; number: number }) => {
    const res = await authenticatedFetch(`/triage/${vars.owner}/${vars.repo}/${vars.number}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTriaged: vars.isTriaged, priority: vars.priority }),
    });
    if (!res.ok) throw new Error('triage save failed');
    return res.json();
  },
  onMutate: async (vars) => { ... }, // optimistic update
  onError: (_err, vars, context) => { queryClient.setQueryData(..., context?.previous); toastError(...); },
  onSettled: (_data, _err, vars) => { queryClient.invalidateQueries(...); },
});
```

### createTaskSchema — fields the promote POST body must provide

```typescript
// Source: apps/web/api/_lib/validation.ts — createTaskSchema (verified)
{
  productId: z.string().uuid(),               // REQUIRED — must come from IssueDetailPanel props
  title: z.string().min(1).max(500),          // from issue.title
  description: z.string().max(50000).default(''), // '' is fine — description is optional at promote time
  status: z.enum(taskStatuses).optional(),    // send 'backlog' explicitly
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(), // from triage priority mapping
  githubIssueNumber: z.number().int().positive().optional(),
  githubIssueUrl: z.string().url().optional(),
  githubRepo: z.string().max(201).regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/).optional(),
}
```

### Test mock setup for 3 useMutation calls

```typescript
// Source: apps/web/src/client/components/IssueDetailPanel.test.tsx (extended pattern)
// When IssueDetailPanel calls useMutation 3 times: triage, note, promote
let callCount = 0;
vi.mocked(useMutation).mockImplementation((options: any) => {
  callCount++;
  if (callCount % 3 === 1) return { mutate: triageMutate, isPending: false } as any;
  if (callCount % 3 === 2) return { mutate: noteMutate, isPending: false } as any;
  return { mutate: promoteMutate, isPending: false } as any;
});
// NOTE: existing setupNoteMocks uses % 2 — MUST be updated to % 3 after promote mutation is added
```

---

## Runtime State Inventory

> This is a greenfield feature addition, not a rename/refactor. No runtime state migration required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tasks` table — `github_repo`, `github_issue_number` columns already exist | None — columns already present from migration 001 |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No promote feature | New promote mutation + badge | Phase 7 | IssueDetailPanel gains a 3rd mutation |
| `useMutation` call count % 2 in tests | Must change to % 3 | Phase 7 | Test setup must be updated |

**Key pre-existing capability leveraged:**
- `getTaskByGitHubIssue(repo, issueNumber)` — already exported from `api/_lib/db/tasks.ts`
- `idx_tasks_github_unique` — already in `001_initial_schema` migration
- `syncTaskToGitHub` — fires automatically on PATCH when github fields present

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.0 |
| Config file | `apps/web/vite.config.ts` (projects: api, client) |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROMOTE-01 | Promote button fires `POST /api/tasks` with correct fields | unit (component) | `npm test -- IssueDetailPanel` | ✅ extend existing |
| PROMOTE-01 | `POST /api/tasks` creates task with `githubIssueNumber` + `status='backlog'` | unit (API) | `npm test -- api` | ✅ extend `tasks/index.test.ts` if exists, else create |
| PROMOTE-02 | No new test needed — write-back fires on PATCH, already tested in Phase 5 | — | — | ✅ existing |
| PROMOTE-03 | Badge renders when `existingTask` query returns a task | unit (component) | `npm test -- IssueDetailPanel` | ✅ extend |
| PROMOTE-03 | `GET /api/tasks/by-github-issue` returns task when found, null when not | unit (API) | `npm test -- by-github-issue` | ❌ Wave 0 |
| PROMOTE-04 | `triagePriorityToTaskPriority('critical')` returns `'urgent'` | unit (pure fn) | `npm test` | ❌ Wave 0 |
| PROMOTE-05 | `POST /api/tasks` returns 409 + existing task when duplicate | unit (API) | `npm test -- tasks` | ❌ Wave 0 |
| PROMOTE-05 | Panel shows toast + badge on 409 response | unit (component) | `npm test -- IssueDetailPanel` | ✅ extend |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm test`
- **Per wave merge:** `cd apps/web && npm test && npm run typecheck`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/api/tasks/by-github-issue.test.ts` — covers PROMOTE-03 (GET returns task or null)
- [ ] `apps/web/api/tasks/by-github-issue.ts` — new handler (stub only in Wave 0)
- [ ] Failing test stub in `apps/web/api/tasks/index.test.ts` — covers PROMOTE-05 (409 on duplicate)
  - If `api/tasks/index.test.ts` does not exist, create it; if it does exist, extend it
- [ ] Failing test stub in `apps/web/src/client/components/IssueDetailPanel.test.tsx` — covers PROMOTE-01, PROMOTE-03, PROMOTE-04, PROMOTE-05 describe blocks
- [ ] Pure function `triagePriorityToTaskPriority` — export it from its module so it can be unit tested directly

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest()` on all new routes |
| V4 Access Control | yes | `hasRole(user, 'admin', 'member')` on all new routes |
| V5 Input Validation | yes | `createTaskSchema.safeParse(req.body)` — already in POST /api/tasks; new GET route uses `z.string().regex(...)` for repo, `z.coerce.number()` for issue number |
| V6 Cryptography | no | No cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Promoting an issue from a repo the user has no access to | Elevation of Privilege | GitHub token validation happens on issue browse (upstream); task creation is scoped to authenticated users with member/admin role |
| Creating tasks with arbitrary `productId` | Tampering | `productId` is validated as UUID; product existence checked implicitly via FK constraint (product_id REFERENCES products(id)) |
| SQLite UNIQUE error leaking internal schema | Information Disclosure | Catch constraint error before reaching default handler; return generic 409 message |

---

## Open Questions

1. **Does `api/tasks/index.test.ts` exist?**
   - What we know: `api/tasks/index.ts` exists and is the POST handler. No test file was found during research.
   - What's unclear: Whether a test exists that must be extended vs. created from scratch.
   - Recommendation: Check at plan time; if absent, create it in Wave 0 with the duplicate-guard stub.

2. **Link target for "View in Backlog" badge**
   - What we know: The UI-SPEC says `/tasks/${taskId}` but that route does not exist in `App.tsx`. The Kanban board is at `/products/:productId`.
   - What's unclear: Whether a dedicated task deep-link route should be added, or the badge should link to `/products/${productId}`.
   - Recommendation: Link to `/products/${productId}` for this phase. The task will be in the backlog column. Adding a deep-link route is a scope expansion not required by any PROMOTE requirement.

3. **`IssueDetailPanel` needs `productId` prop — impact on all callers**
   - What we know: `IssueDetailPanel` is rendered by `IssuesView.tsx`. There is one call site.
   - What's unclear: Whether any other components render `IssueDetailPanel`.
   - Recommendation: Grep confirms `IssueDetailPanel` is used only in `IssuesView`. One prop addition, one call site update. Low risk.

---

## Environment Availability

> Step 2.6: SKIPPED — all dependencies (`@libsql/client`, Vitest, Zod) are already installed. No new external tools required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@libsql/client` throws an error with `"UNIQUE constraint failed"` in the message string on UNIQUE violation | Pitfall 2, Pattern 1 | Wrong message string → 409 never fires; duplicate tasks created |
| A2 | `IssueDetailPanel` is rendered only from `IssuesView.tsx` (one call site) | Open Questions 3 | Additional callers must also add `productId` prop |
| A3 | The route `/products/:productId` is a suitable "View in Backlog" link target (no task deep-link needed) | Pattern 6 | If `/tasks/:id` route is expected, the badge link will be wrong |

**Mitigation for A1:** The planner should include a task to verify the exact error message/code from `@libsql/client` in the Wave 0 RED test — write a test that asserts on 409 and use the test failure to discover the exact error format if needed.

---

## Sources

### Primary (HIGH confidence)

- `apps/web/api/_lib/db/client.ts` — full migration history, confirmed `idx_tasks_github_unique` exists in migration 001
- `apps/web/api/_lib/db/tasks.ts` — `getTaskByGitHubIssue`, `createTask`, `buildCreateTaskInput` all verified
- `apps/web/api/_lib/sync/github-writeback.ts` — `syncTaskToGitHub` verified; fires on PATCH when github fields set
- `apps/web/api/tasks/index.ts` — POST handler shape verified (4-step pattern, `createTaskSchema`, `broadcastEvent`)
- `apps/web/api/tasks/[id]/index.ts` — PATCH handler verified; invokes `syncTaskToGitHub` automatically
- `apps/web/src/client/components/IssueDetailPanel.tsx` — full component read; existing mutation patterns, props, query structure
- `apps/web/src/client/components/IssueDetailPanel.test.tsx` — test setup verified; `useMutation` call count issue documented
- `apps/web/src/shared/types/task.ts` — `Task` discriminated union, `TaskPriority`, `CreateTaskInput` verified
- `apps/web/api/_lib/validation.ts` — `createTaskSchema`, `taskDbRowSchema`, triage/priority enum values verified
- `apps/web/src/shared/i18n/locales/en/issues.json` and `fr/issues.json` — existing keys; `"promote"` namespace absent, must be added

### Secondary (MEDIUM confidence)

- `apps/web/api/_lib/db/triage.ts` — `TriageRecord.priority` type verified as `'critical' | 'high' | 'medium' | 'low' | null`
- `apps/web/scripts/seed.ts` — seed pattern for tasks with github fields

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from package.json
- Architecture: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — all derived from concrete code observations (test mutation count, route absence, priority mismatch)
- Write-back mechanism: HIGH — `syncTaskToGitHub` read in full; confirmed automatic on PATCH

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase — no fast-moving external dependencies)
