---
phase: 05-triage-actions
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/web/src/client/components/IssueDetailPanel.test.tsx
  - apps/web/src/client/components/IssuesView.test.tsx
  - apps/web/src/client/components/IssueListRow.test.tsx
  - apps/web/src/client/components/IssueListRow.tsx
  - apps/web/src/shared/i18n/locales/en/issues.json
  - apps/web/src/shared/i18n/locales/fr/issues.json
  - apps/web/src/client/components/IssueDetailPanel.tsx
  - apps/web/src/client/components/AllIssuesView.test.tsx
  - apps/web/src/client/components/IssuesView.tsx
  - apps/web/src/client/components/AllIssuesView.tsx
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 05 introduces triage actions (triaged toggle, priority selector, optimistic mutations, closed-issue warning) in `IssueDetailPanel`, surfaces triage badge slots in `IssueListRow`, propagates triage state to both `IssuesView` and `AllIssuesView` via an `onTriageLoad` callback, and adds j/k keyboard navigation. The implementation is well-structured and follows project conventions — parse-don't-validate at the API boundary, 4-step handler shape, i18n parity across en/fr, Zustand-based triage cache.

No critical security issues were found. Four warnings were identified that could cause incorrect runtime behaviour: a stale-closure risk in the keyboard handler when search is active, an unchecked array access in the keyboard nav logic, a missing `Content-Type` header on the PUT mutation, and an incomplete i18n key stub in the EN locale. Five info items cover dead/duplicated i18n keys, a `.todo` test block left incomplete, a loose `as any` cast, and minor code-quality notes.

---

## Warnings

### WR-01: Keyboard handler captures stale `filteredIssues` when search changes mid-session

**File:** `apps/web/src/client/components/IssuesView.tsx:140-161`

**Issue:** The `useEffect` dependency array is `[selectedIssueId, filteredIssues]`. When the search filter changes, `filteredIssues` is a new array reference (re-derived by `useMemo`), so the effect re-registers correctly. However, `filteredIssues` is itself derived from `allIssues` (the flattened `data.pages`), which is an **inline expression** on line 121 — not memoized. Every render recreates `allIssues`, which causes `filteredIssues` to be a new reference on every render even when the underlying data has not changed. This makes the `useEffect` re-register (remove + add) the `keydown` listener on every render while the panel is open, creating unnecessary churn and a brief window where no listener is attached.

**Fix:** Memoize `allIssues` the same way `filteredIssues` is memoized:

```typescript
const allIssues: GitHubIssue[] = useMemo(
  () => data?.pages.flatMap(p => p.issues) ?? [],
  [data]
);
```

The same pattern applies to `AllIssuesView.tsx` line 73-86 where `allIssues` is already memoized — `IssuesView.tsx` just needs to be brought to parity.

---

### WR-02: Off-by-one risk — `filteredIssues[currentIndex + 1]` accessed without bounds guard when `currentIndex === -1`

**File:** `apps/web/src/client/components/IssuesView.tsx:151-155`

**Issue:** When `selectedIssueId` is set but the currently-selected issue no longer appears in `filteredIssues` (e.g., because a search filter was typed immediately after opening a panel), `findIndex` returns `-1`. The guard `currentIndex < filteredIssues.length - 1` evaluates to `true` for `-1 < N-1` (always true when `N >= 1`), so `filteredIssues[-1 + 1]` → `filteredIssues[0]` is accessed. Pressing `j` silently jumps to the first issue instead of doing nothing, which is surprising behaviour and violates the boundary-guard contract tested in the test suite.

The same code is duplicated in `AllIssuesView.tsx` at lines 111-115 and carries the same bug.

**Fix:** Add an explicit guard for `currentIndex === -1`:

```typescript
function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    const currentIndex = filteredIssues.findIndex(i => i.id === selectedIssueId);
    if (currentIndex === -1) return; // selected issue filtered out — do nothing
    if (e.key === 'j' && currentIndex < filteredIssues.length - 1) {
      setSelectedIssueId(filteredIssues[currentIndex + 1].id);
    } else if (e.key === 'k' && currentIndex > 0) {
      setSelectedIssueId(filteredIssues[currentIndex - 1].id);
    }
  }
}
```

Apply the same fix to `AllIssuesView.tsx:111-115`.

---

### WR-03: PUT mutation missing `Content-Type: application/json` header

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:65-71`

**Issue:** The `mutationFn` sends a JSON body via `authenticatedFetch` but does not set `Content-Type: application/json`. Depending on how `authenticatedFetch` is implemented (and whether it defaults this header), the Vercel API handler's `req.body` may be `undefined` or an unparsed string. If the body is unparsed, `triagePutBodySchema.safeParse(req.body)` will return a validation error and the mutation will silently fail with a 400, triggering the rollback toast — user-visible but confusing.

```typescript
// current — no Content-Type
const res = await authenticatedFetch(`/triage/${owner}/${repo}/${issue!.number}`, {
  method: 'PUT',
  body: JSON.stringify(updates),
});
```

**Fix:**

```typescript
const res = await authenticatedFetch(`/triage/${owner}/${repo}/${issue!.number}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates),
});
```

---

### WR-04: EN i18n key `triage.markTriaged` value is misleading — says "Triaged" but key name implies untriaged CTA

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:64`

**Issue:** The key `triage.markTriaged` has value `"Triaged"` in the EN locale. In `IssueDetailPanel.tsx` line 172, it is used as the button label when `!triageData?.isTriaged` (i.e., the action label before the issue is triaged). The FR locale correctly uses `"Triage effectué"` (past tense, "Triage done"). However, the EN value `"Triaged"` (also past tense) is used as the **call-to-action** before triaging, which is confusing to users — it reads as if the issue is already triaged. The value should be an active CTA like `"Mark as Triaged"`.

The test mock on line 8 of `IssueDetailPanel.test.tsx` already uses `'Mark as Triaged'` as the expected stub, so tests pass, but the production EN locale differs from test intent.

**Fix:** Update `en/issues.json`:

```json
"markTriaged": "Mark as Triaged"
```

---

## Info

### IN-01: Duplicate i18n key — `triage.triaged` and `triage.markTriaged` are distinct keys that currently share the value "Triaged"

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:64-66`

**Issue:** After fixing WR-04 above, `triage.markTriaged` → `"Mark as Triaged"` and `triage.triaged` → `"Triaged"` will be distinct. However, in the current file both resolve to `"Triaged"`. The FR locale already differentiates them (`markTriaged: "Triage effectué"` vs `triaged: "Traité"`). No code change needed beyond WR-04 fix — flagged as a documentation note.

---

### IN-02: Dead i18n keys — `triage.triagedAriaLabel` is never consumed in source

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:67`, `apps/web/src/shared/i18n/locales/fr/issues.json:67`

**Issue:** Both locale files define `triage.triagedAriaLabel` (`"Toggle triaged status"` / `"Basculer le statut de triage"`). The implementation in `IssueDetailPanel.tsx` line 160 uses `triage.markTriagedAriaLabel` (not `triage.triagedAriaLabel`). The key `triage.triagedAriaLabel` is unused dead code. It should either be removed from both locale files or the component should reference it consistently.

---

### IN-03: `it.todo` block for optimistic update tests left incomplete

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:161-164`

**Issue:** TRIAGE-03 has three `it.todo` stubs covering optimistic update rollback behaviour. These are the most safety-critical paths in the triage implementation (rollback on error, toast after rollback). Leaving them as `.todo` means the rollback path has zero test coverage. Per the project's Red-Green TDD principle (CLAUDE.md), these should be implemented before the phase is considered complete.

---

### IN-04: Loose `as any` cast in `handleTriageLoad` suppresses type safety

**File:** `apps/web/src/client/components/IssuesView.tsx:44`, `apps/web/src/client/components/AllIssuesView.tsx:30`

**Issue:** Both `handleTriageLoad` implementations cast the incoming `priority: string | null` to `'critical' | 'high' | 'medium' | 'low' | null` using `as`. If the API returns an unexpected priority value (e.g., after a schema migration), the cast silently accepts it and stores it in `issueTriageCache`, which is then passed directly to `IssueListRow` where it's used as an index into `PRIORITY_PILL_CLASSES`. An unrecognised key returns `undefined`, causing the `cn()` call to receive `undefined` — no crash, but the pill renders with no colour classes.

A Zod parse or explicit narrowing guard would be safer:

```typescript
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
type Priority = typeof VALID_PRIORITIES[number];

const priority: Priority | null =
  triageState.priority !== null && VALID_PRIORITIES.includes(triageState.priority as Priority)
    ? (triageState.priority as Priority)
    : null;
```

---

### IN-05: `IssuesView` issues list pane renders rows without `<ol>/<li>` semantic list markup

**File:** `apps/web/src/client/components/IssuesView.tsx:239-247`

**Issue:** `AllIssuesView.tsx` correctly wraps issue rows in `<ol>/<li>` (lines 232-244), but `IssuesView.tsx` renders them as bare `<div>` elements with no list semantics. The `AllIssuesView.test.tsx` tests use `screen.getAllByRole('listitem')` to find rows, which only works because of the `<li>` wrapping in `AllIssuesView`. The `IssuesView` tests use `data-testid="row"` (via the mock), so the inconsistency is hidden by the test setup. Screen-reader users of `IssuesView` will not receive list navigation semantics. The pattern should be consistent across both views.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
