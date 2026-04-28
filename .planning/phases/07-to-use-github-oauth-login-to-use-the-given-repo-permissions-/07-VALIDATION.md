---
phase: 7
slug: promote-to-backlog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.0 |
| **Config file** | `apps/web/vite.config.ts` (projects: api, client) |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test && npm run typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test && npm run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 0 | PROMOTE-03, PROMOTE-05 | — | N/A | unit (API) | `cd apps/web && npm test -- by-github-issue` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 0 | PROMOTE-05 | — | Duplicate returns 409 | unit (API) | `cd apps/web && npm test -- tasks` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 0 | PROMOTE-04 | — | N/A | unit (pure fn) | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 7-01-04 | 01 | 0 | PROMOTE-01, PROMOTE-03, PROMOTE-04, PROMOTE-05 | — | N/A | unit (component) | `cd apps/web && npm test -- IssueDetailPanel` | ✅ extend | ⬜ pending |
| 7-02-01 | 02 | 1 | PROMOTE-04 | — | N/A | unit (pure fn) | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 7-02-02 | 02 | 1 | PROMOTE-03 | T: auth check | Auth required on GET | unit (API) | `cd apps/web && npm test -- by-github-issue` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 | 1 | PROMOTE-05 | T: UNIQUE leak | 409 not 500 on duplicate | unit (API) | `cd apps/web && npm test -- tasks` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 | 2 | PROMOTE-01, PROMOTE-03, PROMOTE-04, PROMOTE-05 | — | N/A | unit (component) | `cd apps/web && npm test -- IssueDetailPanel` | ✅ extend | ⬜ pending |
| 7-05-01 | 05 | 2 | PROMOTE-02 | — | Write-back auto-fires | manual smoke | `PATCH /api/tasks/:id` verify GitHub comment | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/api/tasks/by-github-issue.ts` — stub handler (GET returns 501 or delegate to `getTaskByGitHubIssue`)
- [ ] `apps/web/api/tasks/by-github-issue.test.ts` — failing stubs for PROMOTE-03 (returns task when found, null when not found)
- [ ] `apps/web/api/tasks/index.test.ts` — failing stub for PROMOTE-05 (409 on duplicate promotion); create if missing, extend if present
- [ ] Failing stubs in `apps/web/src/client/components/IssueDetailPanel.test.tsx` — PROMOTE-01, PROMOTE-03, PROMOTE-04, PROMOTE-05 describe blocks; update `useMutation` mock from `% 2` to `% 3`

*Note: Existing test infrastructure (Vitest, jsdom, react-testing-library) already installed — no new framework setup needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Promoted task edit in Currents writes back to GitHub issue | PROMOTE-02 | End-to-end flow requires live GitHub token and real DB; no mock for write-back in dev env | 1. Promote an issue to backlog. 2. Edit the Currents task title. 3. PATCH fires `syncTaskToGitHub`. 4. Verify GitHub issue title matches. |
| "View in Backlog" badge links to correct Kanban column | PROMOTE-03 | Routing/navigation requires browser | Promote an issue → click "View in Backlog" → verify user lands on `/products/:productId` and task is visible in backlog column |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
