---
status: diagnosed
phase: 05-triage-actions
source: [05-05-SUMMARY.md, 05-06-SUMMARY.md]
type: re-verification
started: 2026-04-22T12:44:29.000Z
updated: 2026-04-22T12:54:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Close Detail Panel (X button + Escape)
expected: Open any issue detail panel. You should see an X (close) button in the top-right corner of the panel header. Clicking the X button should close the panel (return to list view). Also press Escape while the panel is open — the panel should close.
result: pass

### 2. j/k Direction (j=up/prev, k=down/next)
expected: Open an issue detail panel. Press `j` — the panel should move to the PREVIOUS issue (up the list). Press `k` — the panel should move to the NEXT issue (down the list). This is the reverse of how it was before.
result: issue
reported: "user wants to revert: j should go down the list (next), k should go up (prev) — standard vim convention"
severity: minor

### 3. Closed Filter Shows Closed Issues
expected: In the Issues tab, click the "Closed" filter button. The issue list should update to show only closed issues (approximately 5 closed issues in mock mode). The list should NOT still show the same open issues.
result: pass

### 4. Priority Mutations Target Correct Issue
expected: Open issue #1, set priority to "High". Navigate to issue #2 via the k key (next). Set priority to "Critical". Refresh the page. Reopen issue #1 — it should show "High". Reopen issue #2 — it should show "Critical". Priorities should NOT be swapped.
result: pass

### 5. Priority Badges Visible on List Without Opening Panel
expected: After setting priority on several issues (or after refreshing to a fresh page load), the issue list should show priority pills (e.g. "High" orange pill) on the row for each issue that has a priority set — WITHOUT needing to open each panel first.
result: issue
reported: "failed, doesn't have priority pills"
severity: major

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "j moves to the next issue (down the list), k moves to the previous issue (up the list) — standard vim convention"
  status: failed
  reason: "User reported: user wants to revert: j should go down the list (next), k should go up (prev) — standard vim convention"
  severity: minor
  test: 2
  root_cause: "05-05 swapped j=prev/up, k=next/down to match what the user reported at the time, but user now wants standard vim convention: j=next/down (currentIndex+1), k=prev/up (currentIndex-1). Needs revert in IssuesView.tsx and AllIssuesView.tsx."
  artifacts:
    - path: "apps/web/src/client/components/IssuesView.tsx"
      issue: "j mapped to currentIndex-1 (prev), should be currentIndex+1 (next)"
    - path: "apps/web/src/client/components/AllIssuesView.tsx"
      issue: "Same — j mapped to currentIndex-1, should be currentIndex+1"
  missing:
    - "Swap j/k back: j → currentIndex+1 (next/down), k → currentIndex-1 (prev/up) in both views"
    - "Update IssuesView.test.tsx direction assertions to match"
  debug_session: ""
- truth: "Priority pills appear on issue list rows on first render without opening each panel"
  status: failed
  reason: "User reported: failed, doesn't have priority pills"
  severity: major
  test: 5
  root_cause: "Mock batch triage handler in github-fixtures.ts (lines 171-176) always returns priority: null for all issues, ignoring the dev.db database. The batch pre-fetch useEffect in IssuesView and AllIssuesView fires correctly and seeds issueTriageCache — but the mock response has null priorities so no badges render. The individual triage endpoint (GET /triage/:owner/:repo/:number) is NOT mocked, so it reads real data from dev.db, which is why badges appear after opening a panel. Fix: update the mock batch handler to call getTriageRecordsBatch() (which uses getClient() → dev.db in mock mode) so batch and individual endpoints return consistent data."
  artifacts:
    - path: "apps/web/scripts/mocks/github-fixtures.ts"
      issue: "Lines 171-176: mock GET /api/triage/:owner/:repo always returns priority: null — ignores dev.db"
  missing:
    - "Import getTriageRecordsBatch from api/_lib/db/triage.ts in github-fixtures.ts mock handler"
    - "Replace hardcoded null response with actual DB query via getTriageRecordsBatch(repoFull, numbers)"
  debug_session: ""
