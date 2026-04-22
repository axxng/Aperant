---
status: complete
phase: 05-triage-actions
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-04-22T11:30:00.000Z
updated: 2026-04-22T12:00:00.000Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Triage Controls Visible in Detail Panel
expected: Open any issue in the Issues tab or All Issues view. Click it to open the detail panel. Below the issue title, you should see a "Mark as Triaged" toggle button and a "Priority: None" dropdown appearing above the labels/meta section.
result: pass

### 2. Toggle Triaged Status
expected: Click the "Mark as Triaged" toggle button on an open issue. The button should immediately show a checkmark icon (optimistic update). Refresh the page and reopen that issue — the triaged state should still be set.
result: pass

### 3. Set Priority
expected: Open an issue detail panel. Click the "Priority: None" dropdown — a menu with Critical, High, Medium, Low options should appear. Select "High". The dropdown label should immediately update to "Priority: High". Reopen the issue after refresh — priority should still be set to High.
result: pass

### 4. Triage Badge on Issue List Row
expected: After setting priority on an issue (e.g. "High"), close the detail panel. That issue's row in the list should show an orange "High" pill badge — without any page refresh. If also triaged, a checkmark badge should appear alongside the priority pill.
result: issue
reported: "stuck at 1, clicking elsewhere nor pressing escape closes the detail panel"
severity: major

### 5. j/k Keyboard Navigation — Next/Prev
expected: Open any issue detail panel. Press `j` — the panel should advance to the next issue in the list. Press `k` — the panel should go back to the previous issue. Both keys should navigate smoothly without clicking.
result: issue
reported: "I'm expecting j to go up, and k to go down, it's currently doing the opposite"
severity: minor

### 6. j/k Boundary Guards
expected: Navigate to the last issue in the list (via j). Press `j` again — nothing should happen (no wrap-around). Navigate to the first issue (via k repeatedly). Press `k` again — nothing should happen.
result: pass

### 7. Input Focus Guard (j/k disabled in text fields)
expected: With the detail panel open, click inside the search/filter input. Type `j` — the issues should NOT navigate. The `j` character should only appear in the search field.
result: pass

### 8. Closed Issue Warning Banner
expected: Switch the issues filter to "Closed". Open a closed issue. A warning banner should appear in the triage section: "This issue is closed. Triage actions are still saved in Currents." (or equivalent French translation in FR locale).
result: issue
reported: "stuck at 1, clicking on Closed filter doesnt change the list (Open issues still in the list)"
severity: major

### 9. Triage State Persists Across Sessions
expected: Set priority and triaged status on an issue. Open the same issue in a second browser tab and refresh. The triage state (checkmark + priority level) should be visible without any action — state is stored in the DB, not just session memory.
result: pass

### 10. Priority Color Coding
expected: Set different priority levels on different issues. Verify the correct badge colors: Critical = red pill, High = orange pill, Medium = yellow pill, Low = muted/gray pill.
result: issue
reported: "unable to test, setting priorities to different issues seems to result in random priorities set, when I refresh to dismiss detail pane"
severity: major

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Detail panel can be closed by clicking outside it or pressing Escape, allowing the user to see triage badges in the issue list"
  status: failed
  reason: "User reported: stuck at 1, clicking elsewhere nor pressing escape closes the detail panel"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "j navigates to the next issue (down the list), k navigates to the previous issue (up the list)"
  status: failed
  reason: "User reported: I'm expecting j to go up, and k to go down, it's currently doing the opposite"
  severity: minor
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Clicking the Closed filter shows only closed issues in the list"
  status: failed
  reason: "User reported: stuck at 1, clicking on Closed filter doesnt change the list (Open issues still in the list)"
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Setting different priority levels on different issues persists correctly — each issue retains its own priority after refresh"
  status: failed
  reason: "User reported: setting priorities to different issues seems to result in random priorities set, when I refresh to dismiss detail pane"
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
