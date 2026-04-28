---
status: partial
phase: 04-cross-repo-unified-view
source: [04-VERIFICATION.md]
started: 2026-04-21T23:20:00.000Z
updated: 2026-04-21T23:20:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-Repo Issue Aggregation (CROSS-01)
expected: Issues from all connected product repos appear in one list, newest first. URL shows /issues. State toggle and keyword search work.
result: [pending]

### 2. Product Color Badges (CROSS-02)
expected: A small colored dot and product name label appear at the right side of each issue row. Dot color matches the product sidebar color. No badge on /products/:id/issues.
result: [pending]

### 3. Partial Failure Banners (CROSS-03)
expected: A red/warning alert banner appears for the blocked repo. Other repos' issues still load below. Retry button retries only that repo. Dismiss (x) hides the banner.
result: [pending]

### 4. Sidebar Collapse/Expand (CROSS-01)
expected: Expanded: Inbox icon + 'All Issues' label. Collapsed: Inbox icon only. Active state highlights when on /issues.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
