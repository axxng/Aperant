---
phase: 05-triage-actions
fixed_at: 2026-04-22T00:00:00Z
review_path: .planning/phases/05-triage-actions/05-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-22T00:00:00Z
**Source review:** .planning/phases/05-triage-actions/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Keyboard handler captures stale `filteredIssues` when search changes mid-session

**Files modified:** `apps/web/src/client/components/IssuesView.tsx`
**Commit:** 85e242bb
**Applied fix:** Wrapped the inline `data?.pages.flatMap(p => p.issues) ?? []` expression (line 121) in a `useMemo` with `[data]` as its dependency. This matches the existing pattern in `AllIssuesView.tsx` and prevents `filteredIssues` from being a new reference on every render, eliminating unnecessary `keydown` listener remove/re-add churn in the `useEffect`.

---

### WR-02: Off-by-one risk — `filteredIssues[currentIndex + 1]` accessed without bounds guard when `currentIndex === -1`

**Files modified:** `apps/web/src/client/components/IssuesView.tsx`, `apps/web/src/client/components/AllIssuesView.tsx`
**Commit:** af20e49d
**Applied fix:** Added `if (currentIndex === -1) return;` immediately after the `findIndex` call in the `handleKeyDown` function in both `IssuesView.tsx` (line 154) and `AllIssuesView.tsx` (line 112). This prevents the silent jump to `filteredIssues[0]` when the selected issue is not present in the filtered list.

---

### WR-03: PUT mutation missing `Content-Type: application/json` header

**Files modified:** `apps/web/src/client/components/IssueDetailPanel.tsx`
**Commit:** 2bc0f82b
**Applied fix:** Added `headers: { 'Content-Type': 'application/json' }` to the `authenticatedFetch` options object in the `triageMutation.mutationFn` (line 68). This ensures the Vercel API handler's body parser correctly deserialises the JSON payload and `triagePutBodySchema.safeParse(req.body)` receives a parsed object rather than a raw string.

---

### WR-04: EN i18n key `triage.markTriaged` value is misleading

**Files modified:** `apps/web/src/shared/i18n/locales/en/issues.json`
**Commit:** b7e3a517
**Applied fix:** Changed `"markTriaged": "Triaged"` to `"markTriaged": "Mark as Triaged"` in the EN locale file (line 64). This aligns with the test mock expectation in `IssueDetailPanel.test.tsx` and makes the call-to-action label clearly distinct from the already-triaged state label (`triage.triaged` which remains `"Triaged"`).

---

_Fixed: 2026-04-22T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
