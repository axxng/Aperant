# Architecture Research — GitHub Issues Triage

**Project:** Currents — GitHub Issues Triage milestone
**Researched:** 2026-04-21
**Based on:** Direct codebase inspection of apps/web/

---

## Component Map

### New backend components

| Component | Location | Purpose |
|-----------|----------|---------|
| `issue_triage` DB table | Turso migration | Stores triage state per (repo, issue_number) pair |
| `api/_lib/db/triage.ts` | New DB module | CRUD for triage records — mirrors pattern in `tasks.ts` |
| `api/triage/[owner]/[repo]/[number].ts` | New API route | GET/PUT triage state for a single issue |
| `api/triage/index.ts` | New API route | GET all triage records (for badge overlays in the issues browser) |
| `api/github/repos/[owner]/[repo]/issues.ts` | Existing — extend | Add `labels` and `assignee` query params to existing route |
| `api/issues/index.ts` | New API route | Server-side cross-repo aggregation endpoint (see Cross-Repo section) |
| `api/tasks/index.ts` | Existing — extend | The existing POST handler already accepts `githubIssueNumber`, `githubRepo`, etc. — no structural changes needed for promote-to-task |

### New frontend components

| Component | Location | Purpose |
|-----------|----------|---------|
| `IssuesView` | `src/client/components/IssuesView.tsx` | Top-level issues browser; renders cross-repo or per-product list |
| `IssueCard` | `src/client/components/IssueCard.tsx` | Single issue row/card with triage badge overlay |
| `IssueFilterBar` | `src/client/components/IssueFilterBar.tsx` | State (open/closed), label multi-select, assignee filter, text search |
| `IssueTriagePanel` | `src/client/components/IssueTriagePanel.tsx` | Slide-over or dialog: priority picker, triaged toggle, notes field, promote button |
| `issues-store.ts` | `src/client/stores/issues-store.ts` | Zustand store: issue list, triage state map, filter state, loading flags |
| Sidebar update | `src/client/components/Sidebar.tsx` | Add "Issues" nav item with inbox-style icon |

The `IssueTriagePanel` is the only component that writes to two systems: it PUTs triage state to `/api/triage/...` and POSTs comments to the existing `/api/github/repos/[owner]/[repo]/issues/[number]/comment` route. Keep those two calls explicit and separate — do not combine into one endpoint.

---

## Data Model

### New table: `issue_triage`

Triage state is **not** stored on the `tasks` table. The `tasks` table represents backlog work items — conflating it with "issues seen during triage" would pollute the backlog and make the triaged/not-triaged distinction invisible. A separate table keeps the two concerns cleanly separated.

```sql
-- Migration: 009_issue_triage.sql
CREATE TABLE IF NOT EXISTS issue_triage (
  id            TEXT PRIMARY KEY,               -- UUID
  repo          TEXT NOT NULL,                  -- "owner/repo" — matches tasks.github_repo
  issue_number  INTEGER NOT NULL,               -- GitHub issue number
  priority      TEXT,                           -- 'low' | 'medium' | 'high' | 'urgent' | NULL (not yet set)
  triaged       INTEGER NOT NULL DEFAULT 0,     -- 0 = untriaged, 1 = triaged (SQLite boolean)
  task_id       TEXT REFERENCES tasks(id)       -- set when issue is promoted; NULL otherwise
                  ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo, issue_number)                    -- one triage record per GitHub issue
);

CREATE INDEX idx_issue_triage_repo ON issue_triage(repo);
CREATE INDEX idx_issue_triage_task_id ON issue_triage(task_id);
```

**Why not attach to the `tasks` table:**
- A triage record exists for issues that have NOT been promoted. Adding a `triaged` column to `tasks` would require creating a task row for every browsed issue, which breaks the tasks semantic entirely.
- Promotes stay linked via the `task_id` foreign key — no duplication.
- The `UNIQUE(repo, issue_number)` constraint is a natural upsert key, so the PUT endpoint can use `INSERT ... ON CONFLICT DO UPDATE`.

**`task_id` column as the promote link:** When an issue is promoted, `issue_triage.task_id` is set to the new task's UUID. The issues browser queries this column to show "promoted" badges and link back to the task. If the task is later deleted, `ON DELETE SET NULL` clears the link without deleting the triage record.

---

## API Routes

### Reuse existing routes (no changes required)

| Route | What it already does |
|-------|---------------------|
| `GET /api/github/repos/[owner]/[repo]/issues` | Fetches issues from GitHub; already supports `state`, `page`, `per_page`. Needs `labels` and `assignee` params added (one-line URLSearchParams extension). |
| `POST /api/github/repos/[owner]/[repo]/issues/[number]/comment` | Posts a comment to GitHub. Already implemented. The triage notes flow calls this directly. |
| `POST /api/tasks` | Creates a backlog task. Already accepts `githubIssueNumber`, `githubIssueUrl`, `githubRepo`, `labels`, `assignees`. The promote-to-task flow calls this as-is. |

### Extend existing: `GET /api/github/repos/[owner]/[repo]/issues`

Add two optional query params — `labels` (comma-separated string, forwarded to GitHub's `labels` param) and `assignee` (string, forwarded directly). The existing `githubIssueQuerySchema` in `validation.ts` gets two optional fields:

```typescript
labels: z.string().optional(),    // e.g. "bug,enhancement"
assignee: z.string().optional(),  // e.g. "octocat"
```

No other structural change to this route.

### New routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/api/triage` | `requireAuth` | Return all triage records (used for badge overlays) |
| `GET` | `/api/triage/[owner]/[repo]/[number]` | `requireAuth` | Get triage state for one issue |
| `PUT` | `/api/triage/[owner]/[repo]/[number]` | `requireRole('admin','member')` | Upsert triage state (priority, triaged flag). Body: `{ priority?, triaged?, task_id? }` |
| `GET` | `/api/issues` | `requireAuth` | Cross-repo aggregated issue list — see Cross-Repo section |

The `/api/triage` routes follow the exact same structure as `/api/tasks` — `requireAuth` middleware, Zod body validation, Turso via `getClient()`.

**No new GitHub proxy routes are needed.** Comments and issue fetching already exist.

---

## Routing

### New React routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/issues` | `IssuesView` (consolidated, all products) | Cross-repo view |
| `/products/:productId/issues` | `IssuesView` (scoped to product's repo) | Per-product view |

Both routes render the same `IssuesView` component. A `productId` prop (or lack thereof) determines whether the component fetches from `/api/issues` (consolidated) or `/api/github/repos/[owner]/[repo]/issues` (single repo).

### App.tsx additions

```typescript
<Route path="/issues" element={<IssuesView />} />
<Route path="/products/:productId/issues" element={<IssuesView />} />
```

### Sidebar navigation

Add an "Issues" nav item above Settings in the sidebar. The consolidated `/issues` link lives at the top level (after "All Products"). Per-product issue links appear as a sub-item under each product row — same pattern as the existing per-product settings link. Use `Inbox` from lucide-react as the icon.

The sidebar currently renders per-product links as `NavLink to={\`/products/${product.id}\`}`. Add a secondary link row: `NavLink to={\`/products/${product.id}/issues\`}` with a smaller "Issues" label, visible in expanded mode only.

---

## Cross-Repo Aggregation

**Recommendation: server-side aggregation endpoint.**

**Why not client-side fan-out:** The client would need to fire N parallel requests (one per product's repo), then merge and sort the results. This works for 2-3 products but degrades at 10+ products — N concurrent GitHub API calls from the browser, each taking 200-500ms, with no ability to deduplicate rate-limit budget. More critically, it leaks the GitHub token to a pattern where the SPA is effectively orchestrating fan-out against a third-party API through a proxy, which is fragile if any one product's repo is misconfigured or rate-limited.

**Server-side aggregation:** A new `GET /api/issues` route loads all products from Turso, extracts their `sources` (type `repo` or `repos`), fires `Promise.allSettled()` calls to `githubFetch()` for each repo, merges the results, attaches triage state from the `issue_triage` table, and returns a single sorted array. Failures for individual repos are returned as partial errors alongside the successful results rather than failing the whole response.

```typescript
// api/issues/index.ts — pseudocode structure
const products = await getAllProducts();
const repos = extractRepos(products);  // deduplicate across products
const settled = await Promise.allSettled(repos.map(r => fetchIssues(r, query)));
const issues = mergeAndSort(settled);
const triageMap = await getTriageByRepos(repos.map(r => r.fullName));
return { issues: attachTriage(issues, triageMap), errors: partialErrors };
```

**Query params forwarded from the client:** `state`, `labels`, `assignee`, `search` (GitHub's `q` param via search API if needed — but simple label/assignee filters work via the list endpoint).

**Response shape:**

```typescript
interface AggregatedIssuesResponse {
  issues: Array<GitHubIssue & { triage?: IssueTriage; productId: string }>;
  errors: Array<{ repo: string; error: string }>;
  hasMore: boolean;
}
```

The `productId` attachment (derived from which product owns the repo) is what powers the product color badge in the consolidated view — mirrors how the Kanban board shows product badges on task cards.

---

## Promote-to-Task Flow

The promote action turns a GitHub issue into a tracked backlog task. Sequence:

1. User opens `IssueTriagePanel` for an issue. The panel shows a "Promote to Backlog" button.
2. User clicks promote. The panel (or a small inline dialog) asks for: target product (default: the product whose repo this issue belongs to), priority, category.
3. **Client calls `POST /api/tasks`** with the issue data mapped to the `createTaskSchema`:
   - `title` ← issue title
   - `description` ← issue body
   - `productId` ← selected product
   - `priority` ← from triage state or user selection
   - `githubIssueNumber`, `githubIssueUrl`, `githubRepo` ← from the issue
   - `labels`, `assignees` ← from the issue
   - `metadata.sourceType: 'github'`
4. On success, the task is created in Turso with `github_sync_pending = 0` (no initial write-back needed — we're reading from GitHub, not pushing to it).
5. **Client calls `PUT /api/triage/[owner]/[repo]/[number]`** with `{ triaged: true, task_id: newTask.id }`. This links the triage record to the new task.
6. `IssueCard` in the browser re-renders with a "Promoted" badge showing `task_id` is set. Clicking the badge could navigate to the task in the Kanban board.

**Why two separate API calls for step 3 and 5:** The task creation uses the existing `/api/tasks` POST endpoint unchanged. The triage link update is a separate concern. Combining them into a single new endpoint would duplicate task creation logic and violate the constraint against duplicating write-back sync logic.

**Write-back after promote:** Once the task exists in Turso and is linked, any subsequent edit to the task (title, description, status, labels, assignees) flows through the existing `syncTaskToGitHub()` in `github-writeback.ts` automatically — because the task has `github_repo` and `github_issue_number` set. No new write-back logic is needed.

---

## Write-Back Integration

Triage notes (ISSUES-04) are posted as GitHub comments. The flow:

1. User types a note in `IssueTriagePanel`.
2. Client calls `POST /api/github/repos/[owner]/[repo]/issues/[number]/comment` — this route already exists and is implemented.
3. The note is posted to GitHub. It is NOT stored in Turso.

**Why not store notes locally:** The PROJECT.md decision log specifies "single source of truth on GitHub" to avoid split-brain. The `comment.ts` route already handles auth, validation (`githubCommentSchema`), and GitHub API calls. There is nothing to build here except the UI that calls it.

**Edge case — comment failure:** If the GitHub API call fails (rate limit, network), the client shows an error toast. No retry queue is needed for comments — unlike task edits, a failed comment has no local representation that needs reconciling. The user simply retries.

**The existing `github-writeback.ts` is NOT involved in comments.** That module handles task → issue sync for field changes (title, body, state, labels, assignees). Comments are fire-and-forget via the proxy route. This boundary is important: do not route triage notes through the write-back retry queue.

---

## Build Order

Dependencies flow top to bottom. Each item can only start after the item above it is complete.

**1. DB migration + triage DB module** (`issue_triage` table + `api/_lib/db/triage.ts`)
- Foundation for all triage state. Nothing else can read/write triage until this exists.

**2. Triage API routes** (`api/triage/index.ts`, `api/triage/[owner]/[repo]/[number].ts`)
- Depends on: step 1
- Unlocks: frontend can now persist triage state

**3. Extend existing issues proxy** (`api/github/repos/[owner]/[repo]/issues.ts` — add `labels`/`assignee` params)
- Depends on: nothing (isolated change to existing route)
- Can be built in parallel with step 1

**4. Cross-repo aggregation endpoint** (`api/issues/index.ts`)
- Depends on: step 1 (needs triage table to attach state), step 3 (reuses same GitHub fetch pattern)
- This is the most complex new route — build it after the simpler pieces are proven

**5. Zustand issues store** (`src/client/stores/issues-store.ts`)
- Depends on: steps 2, 3, 4 (API contracts must be stable)
- Defines the client-side data shapes everything else renders from

**6. `IssueCard` + `IssueFilterBar`** (read-only browse)
- Depends on: step 5
- Delivers ISSUES-01 and ISSUES-02 without any write operations

**7. Routing + Sidebar** (add `/issues` and `/products/:id/issues` routes)
- Depends on: step 6
- Can be stubbed with a placeholder view during step 6 development

**8. `IssueTriagePanel`** (triage state writes + comment post)
- Depends on: steps 2, 5, 6
- Delivers ISSUES-03 and ISSUES-04
- The promote button within this panel depends on step 9 working

**9. Promote-to-task flow**
- Depends on: steps 2, 5, 8 (triage panel is the entry point)
- Reuses `POST /api/tasks` unchanged; adds `PUT /api/triage` to set `task_id`
- Delivers ISSUES-05

**Parallelisation opportunity:** Steps 1, 3 can be built simultaneously. Steps 6 and 7 can be built simultaneously once step 5 is done.
