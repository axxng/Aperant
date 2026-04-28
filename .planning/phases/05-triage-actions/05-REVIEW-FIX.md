---
phase: 05-triage-actions
fixed_at: 2026-04-22T12:41:50Z
review_path: .planning/phases/05-triage-actions/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-22T12:41:50Z
**Source review:** .planning/phases/05-triage-actions/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### WR-01: Non-atomic upsert race condition

**Files modified:** `apps/web/api/_lib/db/triage.ts`
**Commit:** bb5d2f30
**Applied fix:** Collapsed the two-step INSERT-then-UPDATE into a single atomic `INSERT ... ON CONFLICT DO UPDATE` statement. Partial-update semantics (only patching supplied fields) are preserved by using conditional expressions (`excluded.is_triaged` vs `issue_triage.is_triaged`) in the SET clause based on whether each field is present in the `updates` argument.

### WR-02: Non-null assertion after SELECT-after-upsert

**Files modified:** `apps/web/api/_lib/db/triage.ts`
**Commit:** bb5d2f30
**Applied fix:** Replaced `return record!;` with an explicit null check that throws a descriptive `Error` if the record is missing after upsert, preventing an unhandled `TypeError` from propagating to the calling handler.

### WR-03: Non-null assertions in IssueDetailPanel event handlers

**Files modified:** `apps/web/src/client/components/IssueDetailPanel.tsx`
**Commit:** 17b08255
**Applied fix:** Added `if (!issue) return;` guard at the top of each of the three callbacks — the TriagedToggle `onClick`, the priority `DropdownMenuItem` `onSelect`, and the Clear `DropdownMenuItem` `onSelect` — before accessing `issue.number`.

### WR-04: Mock labels endpoint returns bare array

**Files modified:** `apps/web/scripts/mocks/github-fixtures.ts`
**Commit:** 7f38d99c
**Applied fix:** Wrapped the `buildLabelFixtures()` return value in `{ labels: buildLabelFixtures() }` to match the `LabelsResult` shape that `IssuesView` reads via `labelsData?.labels`.

### WR-05: Missing X icon in lucide-react mock + no onClose test

**Files modified:** `apps/web/src/client/components/IssueDetailPanel.test.tsx`
**Commit:** 5a4b117b
**Applied fix:** Added `X: () => <svg data-testid="close-icon" />` to the `lucide-react` mock. Added `'detail.closePanel'` key mapping to the `t` stub. Added a new `describe('IssueDetailPanel — close button')` block with a test that verifies `onClose` is called once when the close button is clicked.

### WR-06: .todo rollback tests

**Files modified:** `apps/web/src/client/components/IssueDetailPanel.test.tsx`
**Commit:** e2a78eb6
**Applied fix:** Promoted the toast mock (`mockToastError`) to module level so rollback tests can assert on it. Replaced all three `it.todo` stubs in `TRIAGE-03` with fully implemented tests: one verifying `onMutate` calls `setQueryData` with a merge function, one verifying `onError` restores the previous data via `setQueryData`, and one verifying `onError` calls the toast error with the correct message. All 13 tests in the file pass.

---

_Fixed: 2026-04-22T12:41:50Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
