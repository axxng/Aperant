---
phase: 5
slug: triage-actions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-W0-01 | W0 | 0 | TRIAGE-01, 02, 03, 06 | — | N/A | unit | `cd apps/web && npx vitest run src/client/components/IssueDetailPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 5-W0-02 | W0 | 0 | TRIAGE-05 | — | N/A | unit | `cd apps/web && npx vitest run src/client/components/IssuesView.test.tsx` | ❌ W0 | ⬜ pending |
| 5-W0-03 | W0 | 0 | TRIAGE-04 | — | N/A | unit | `cd apps/web && npx vitest run src/client/components/IssueListRow.test.tsx` | ✅ extend | ⬜ pending |
| 5-01-01 | 01 | 1 | TRIAGE-01 | — | TriagedToggle renders unchecked; click calls mutation with `{isTriaged: true}` | unit | `cd apps/web && npx vitest run src/client/components/IssueDetailPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | TRIAGE-01 | — | Triaged state renders CheckCircle2 icon (`aria-pressed=true`) | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | TRIAGE-02 | — | PrioritySelector opens dropdown with Critical/High/Medium/Low/Clear | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 1 | TRIAGE-02 | — | Selecting priority calls mutation with `{priority: 'high'}` | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 1 | TRIAGE-03 | — | Optimistic update sets query cache immediately on mutate | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-06 | 01 | 1 | TRIAGE-03 | — | Error rollback restores previous cache value | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-07 | 01 | 1 | TRIAGE-06 | — | ClosedIssueWarning renders when issue.state === 'closed' | unit | same file | ❌ W0 | ⬜ pending |
| 5-01-08 | 01 | 1 | TRIAGE-06 | — | ClosedIssueWarning not rendered for open issues | unit | same file | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | TRIAGE-04 | — | TriageBadgeSlot renders checkmark when `triageState.isTriaged=true` | unit | `cd apps/web && npx vitest run src/client/components/IssueListRow.test.tsx` | ✅ extend | ⬜ pending |
| 5-02-02 | 02 | 1 | TRIAGE-04 | — | TriageBadgeSlot renders priority pill when priority set | unit | same file | ✅ extend | ⬜ pending |
| 5-02-03 | 02 | 1 | TRIAGE-04 | — | TriageBadgeSlot renders nothing when no triageState prop | unit | same file | ✅ extend | ⬜ pending |
| 5-03-01 | 03 | 2 | TRIAGE-05 | — | j key moves to next issue when panel is open | unit | `cd apps/web && npx vitest run src/client/components/IssuesView.test.tsx` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | TRIAGE-05 | — | k key moves to previous issue; boundary: k on first does nothing | unit | same file | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | TRIAGE-05 | — | j/k do nothing when panel is closed | unit | same file | ❌ W0 | ⬜ pending |
| 5-03-04 | 03 | 2 | TRIAGE-05 | — | j/k do nothing when focus is on INPUT element | unit | same file | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/client/components/IssueDetailPanel.test.tsx` — stubs for TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-06 (new file)
- [ ] `src/client/components/IssuesView.test.tsx` — stubs for TRIAGE-05 (new file)
- [ ] `src/client/components/IssueListRow.test.tsx` — extend existing stubs for TRIAGE-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Triage badge visible to all team members after page refresh | TRIAGE-03 | Requires two browser sessions + shared DB state | 1. Open issue, set priority in session A; 2. Reload session B; 3. Open same issue — verify triage state visible |
| Priority pill colors correct in both light and dark themes | TRIAGE-04 | Visual regression — no automated color assertion | Toggle theme, open issues list with triaged issues, verify Critical=red, High=orange, Medium=yellow, Low=muted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
