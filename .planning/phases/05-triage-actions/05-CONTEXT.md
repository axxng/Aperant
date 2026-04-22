# Phase 5: Triage Actions - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds triage actions to the existing issue detail panel. After this phase:
- Users can mark any issue as triaged (toggle) and assign internal priority (Critical / High / Medium / Low) from the detail panel
- All triage state is stored in the Currents DB only — no GitHub writes, no labels created on GitHub
- Triaged issues show a visual badge (✓ + priority pill) on their row in the issue list
- j/k keyboard shortcuts navigate between issues while the detail panel is open
- A warning appears when the user tries to take triage actions on a closed GitHub issue

The API routes (`GET/PUT /api/triage/[owner]/[repo]/[number]`) and DB table (`issue_triage`) were created in Phase 1 and are ready to use. This phase is purely UI + integration work.

No note posting (Phase 6). No backlog promotion (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Triage Controls Placement (D-01)
- **D-01:** A **dedicated triage section** sits at the top of `IssueDetailPanel`, pinned between the issue title/number row and the labels/meta section. It is always visible when the panel opens — users don't need to scroll to triage.
- Layout: A compact horizontal row with two controls: a "Triaged" toggle button (✓ / checkbox) on the left, and a "Priority" dropdown on the right.

### Priority Selector (D-02)
- **D-02:** A **dropdown select** with a compact trigger showing the current priority (e.g., `Priority: High ▾`). When no priority is set, shows `Priority: None ▾`.
- Dropdown options: Critical, High, Medium, Low, and a **Clear** option to remove priority.
- Use Radix UI `DropdownMenu` or `Select` — whichever fits cleanest with existing Radix usage in the project.

### Triaged Badge on List Row (D-03, D-04)
- **D-03:** When an issue is triaged, a **✓ checkmark icon** appears at the right side of the `IssueListRow` (after the product badge slot).
- **D-04:** When priority is set, a **priority-colored pill** appears alongside the checkmark: `[High]✓` for triaged + priority, `[High]` alone for priority-only (not yet triaged). Priority colors: Critical = red, High = orange, Medium = yellow, Low = blue/gray.
- When neither triaged nor priority is set, the row appears as today (no badge).

### Keyboard Navigation (D-05)
- **D-05:** j/k shortcuts activate **only when the detail panel is open**. Pressing `j` moves to the next issue in the visible list AND auto-updates the panel to show that issue. `k` moves to the previous issue. This matches the GitHub issues UX pattern.
- When the panel is closed, j/k do nothing (no cursor-in-list mode needed for this phase).

### Closed Issue Warning (D-06)
- **D-06:** When the user opens the detail panel for a **closed** GitHub issue, an **inline warning banner** appears inside the triage section (above the toggle/priority controls): "This issue is closed. Triage actions will still be saved in Currents."
- This is informational (not a blocking confirm dialog) — users can still triage closed issues if they want. The warning satisfies TRIAGE-06 without being disruptive.

### Triage State Loading (D-07)
- **D-07:** Triage state is fetched **lazily per issue** — only when the detail panel opens for that issue. One `GET /api/triage/:owner/:repo/:number` call fires when `issue` prop changes in the panel. TanStack Query caches the result per `[triage, owner, repo, number]` key.
- No eager batch-fetching of triage state for all visible issues (avoids N API calls on page load). Badge display for the list relies on the cached triage state from any prior panel open for that issue in the same session.

### Optimistic Updates (D-08)
- **D-08:** Triage mutations (PUT) are **optimistic** — the toggle and priority dropdown update immediately in the UI, then reconcile after the server responds. On error, the state rolls back and a toast error is shown.

### Claude's Discretion
- Exact Radix component for priority selector (DropdownMenu vs Select) — choose whichever is cleanest with existing Radix usage
- Whether `IssueDetailPanel` receives a `triageState` prop from its parent or fetches it internally via TanStack Query — follow whatever is cleanest given the existing prop shape
- Animation/transition for the triage section appearing (or no animation — keep it simple)
- Exact priority colors — follow Tailwind semantic colors that work in both light and dark themes
- Whether the ✓ icon on the list row uses a lucide-react icon or a styled character

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Triage API + DB (Phase 1)
- `apps/web/api/triage/[owner]/[repo]/[number].ts` — GET and PUT route; already implemented; accepts `{ isTriaged, priority }` in PUT body
- `apps/web/api/_lib/db/triage.ts` — `TriageRecord`, `TriageState`, `getTriageRecord()`, `upsertTriageRecord()`, `rowToTriage()` — all ready
- `apps/web/api/_lib/db/triage.test.ts` — existing test coverage for DB helpers

### Existing Issues UI (Phase 2 + 4)
- `apps/web/src/client/components/IssueDetailPanel.tsx` — the slide-in right panel; add triage section at top
- `apps/web/src/client/components/IssueListRow.tsx` — add checkmark + priority pill to the right side
- `apps/web/src/client/components/IssueListRow.test.tsx` — extend tests for badge rendering

### Existing Issues Views (context for where IssueDetailPanel is controlled)
- `apps/web/src/client/components/IssuesView.tsx` — single-repo view; passes `issue` and `isOpen` to panel
- `apps/web/src/client/components/AllIssuesView.tsx` — cross-repo view; same panel usage

### Shared Types
- `apps/web/src/shared/types/github.ts` — `GitHubIssue` type; check `state` field for closed-issue warning (D-06)

### Engineering Principles (MANDATORY)
- `CLAUDE.md` — 4-step handler shape, parse-don't-validate, TDD (write failing test first), FSM/discriminated unions, mocked services

### i18n
- `apps/web/src/shared/i18n/locales/en/issues.json` — add triage keys here
- `apps/web/src/shared/i18n/locales/fr/issues.json` — same keys in French

### Requirements
- `.planning/REQUIREMENTS.md` — TRIAGE-01 through TRIAGE-06 define the acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueDetailPanel.tsx` — the panel to extend; currently has: badge+number, title, meta (labels/assignees/date), "View on GitHub" button, divider, markdown body. Triage row inserts after title section.
- `IssueListRow.tsx` — 44px row; has `productBadge?: ProductBadgeInfo` optional prop as precedent for optional right-side additions
- Radix UI components already installed: `Button`, `Badge`, `ScrollArea`, `Tooltip` — use same pattern for `DropdownMenu` or `Select` for priority
- `IssueListRow.test.tsx` and `AllIssuesView.test.tsx` — test patterns to follow for new tests
- `api/_lib/db/triage.ts` — `TriageRecord` type, `TriageState` discriminated union already defined

### Established Patterns
- TanStack Query v5 `useQuery` / `useMutation` for data fetching and mutations (see `IssuesView.tsx`, `AllIssuesView.tsx`)
- Optimistic updates via `queryClient.setQueryData()` in `onMutate` + rollback in `onError`
- `useTranslation('issues')` namespace for issues-related text; add new triage sub-keys there
- Keyboard event handling via `useEffect` + `window.addEventListener('keydown', ...)` pattern (no dedicated shortcut library in use)
- `cn()` helper for conditional classNames (clsx + tailwind-merge)

### Integration Points
- `IssueDetailPanel` receives `issue` prop from both `IssuesView` and `AllIssuesView`; owner/repo must be derivable from the issue or passed as props (issues already carry `htmlUrl` which contains owner/repo, or pass explicitly from parent)
- `IssueListRow` receives `issue` prop; triaged state must be passed in (same approach as `productBadge` optional prop)

</code_context>

<specifics>
## Specific Ideas

- The triage section layout: `[✓ Triaged]  [Priority: High ▾]` — compact horizontal row with a separator below it before the meta section
- Priority pill colors to match severity conventions: Critical = destructive/red, High = orange, Medium = yellow, Low = muted/gray
- The "Clear" option in the priority dropdown removes priority (sets to null) — important for correcting mistakes
- Closed-issue warning banner text (TRIAGE-06): "This issue is closed. Triage actions are still saved in Currents." — inline, subtle, not blocking

</specifics>

<deferred>
## Deferred Ideas

- Batch triage (triage multiple issues without opening each panel) — TRIAGE-V2-02 in REQUIREMENTS.md, deferred
- Snooze with wake-up date — TRIAGE-V2-01, deferred
- Eager batch-load of triage state for all visible issues — deferred; lazy-per-panel avoids N API calls on initial load
- List-mode keyboard navigation (j/k cursor in list without open panel) — simple enough to add later if needed

</deferred>

---

*Phase: 05-triage-actions*
*Context gathered: 2026-04-22*
