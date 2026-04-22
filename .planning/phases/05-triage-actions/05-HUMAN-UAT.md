---
status: partial
phase: 05-triage-actions
source: [05-VERIFICATION.md]
started: 2026-04-22T12:00:00Z
updated: 2026-04-22T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Triage state persistence across browser refresh (TRIAGE-03)

**Setup:** Start dev server with `MOCK_SERVICES=true` or use a real instance with GitHub OAuth.

**Test:** Open any issue, mark it as triaged, set priority to High. Reload the browser tab.

expected: The TriagedToggle shows "Triaged" with a checkmark. Priority trigger shows "Priority: high". The orange "High" pill appears on the issue list row.
result: [pending]

### 2. Triage badge appears on row without page refresh (TRIAGE-04 session-level)

**Test:** Click an issue to open the panel. Set priority to Critical. Close the panel (press Escape or click X). Observe the issue row in the list.

expected: A red "Critical" pill appears on the issue row immediately — no page reload required.
result: [pending]

### 3. No stale closure mutation during j/k navigation (TRIAGE-05 + Gap 4)

**Test:** Open issue A, set priority to Medium. Press k to navigate to issue B. Set priority to High on issue B. Reload the page.

expected: Issue A shows Medium, issue B shows High. No priority bleed between issues during j/k navigation.
result: [pending]

### 4. Closed issue warning appearance (TRIAGE-06)

**Test:** Switch to the "Closed" filter in the issues list. Click any closed issue to open the detail panel.

expected: A warning banner with an AlertTriangle icon reads "This issue is closed. Triage actions are still saved in Currents." The TriagedToggle and PrioritySelector remain functional.
result: [pending]

### 5. Escape key and X button both close the panel

**Test:** Open any issue. Press Escape. Then open another issue and click the X button in the top-right of the panel.

expected: Both actions close the panel (slides away). No console errors.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
