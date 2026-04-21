# Phase 4: Cross-Repo Unified View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 04-cross-repo-unified-view
**Areas discussed:** Navigation entry point, Fan-out strategy, Filtering, Partial failure

---

## Navigation Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar link: "All Issues" | New sidebar entry below 'All Products', navigates to /issues. Immediately discoverable. | ✓ |
| Tab on consolidated view | Add 'Issues' tab alongside 'Kanban' at the top-level / route. Consistent with per-product tab pattern but adds a tab bar that doesn't currently exist. | |

**User's choice:** Sidebar link — "All Issues" → `/issues`
**Notes:** User confirmed the sidebar link layout preview (All Products / All Issues / --- / product list).

---

## Fan-out Strategy

### Fetch approach

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side parallel fetches | Frontend fires one TanStack Query per product in parallel using existing per-product issues endpoint. Simpler, natural per-repo error states. No new API endpoint. | ✓ |
| New server-side fan-out endpoint | New GET /api/github/issues/all fetches all repos server-side and returns merged list. Matches ROADMAP wording exactly. More complex. | |

**User's choice:** Client-side parallel fetches

### Sort order

| Option | Description | Selected |
|--------|-------------|----------|
| Most recently updated across all repos | updated_at desc globally — best for monitoring active discussions. Same default as Phase 2. | ✓ |
| Grouped by product, updated desc within each | Issues in product sections, each sorted by updated_at. Easier per-product scanning. | |

**User's choice:** Most recently updated (global updated_at desc)

---

## Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| State + keyword search | Open/Closed toggle + client-side title search. No label/assignee (repo-specific). | ✓ |
| State only | Just the open/closed toggle. Minimal. | |
| Full filters (state + search + labels + assignees) | Best-effort cross-repo label/assignee filtering. Complex edge cases from mismatched label sets. | |

**User's choice:** State + keyword search

---

## Partial Failure Presentation

### Error indicator style

| Option | Description | Selected |
|--------|-------------|----------|
| Error banner per failing repo | Dismissible alert strip at top of list per failed repo with Retry button. ⚠ Acme API — could not load issues [Retry] [x] | ✓ |
| Inline error row in list | Error row injected into the list at the position where that repo's issues would appear. Less prominent. | |

**User's choice:** Dismissible error banner per failing repo

### Dismissibility

| Option | Description | Selected |
|--------|-------------|----------|
| Dismissible | User can close with ×. Issues from successful repos remain visible without clutter. | ✓ |
| Persistent until resolved | Banner stays until user retries and succeeds, or navigates away. | |

**User's choice:** Dismissible

---

## Claude's Discretion

- `useQueries()` vs multiple `useQuery()` hooks for dynamic product count
- Exact icon for "All Issues" sidebar link
- Whether `IssueListRow` is extended via prop or a thin wrapper adds the product badge
- Loading state skeleton strategy (show skeletons while any queries still loading)

## Deferred Ideas

None — discussion stayed within Phase 4 scope.
