---
phase: 4
slug: cross-repo-unified-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-W0-01 | Wave 0 | 0 | CROSS-02 | — | N/A | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 4-W0-02 | Wave 0 | 0 | CROSS-01, CROSS-03 | — | N/A | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 4-01-01 | 01 | 1 | CROSS-02 | — | productBadge prop absent → no badge rendered (backward compat) | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | CROSS-01 | — | Issues from N repos merged and sorted by updatedAt desc | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | CROSS-03 | — | One failed useQueries result shows error banner; others render normally | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | CROSS-01 | — | /issues route renders AllIssuesView; sidebar NavLink present | unit | `cd apps/web && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/client/components/IssueListRow.test.tsx` — stubs for CROSS-02 (productBadge prop renders badge; absent = no badge)
- [ ] `apps/web/src/client/components/AllIssuesView.test.tsx` — stubs for CROSS-01 (merged issues sorted by updatedAt), CROSS-03 (error banner for failed query; successful queries still render)
- [ ] Shared test setup: mock `useProductStore` and `@tanstack/react-query`'s `useQueries` — ensure mocking pattern follows existing test files

*Wave 0 test stubs must be the FIRST plan in Phase 4 execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth token scope allows repo access for fan-out queries | CROSS-01 | STATE.md concern: "Test 6 skipped — OAuth token lacked repo access in test env" — requires real credentials | Log in with a GitHub OAuth token that has `repo` scope; navigate to `/issues`; verify all connected repos load their issues |
| Product color dot renders correctly for arbitrary hex values | CROSS-02 | Inline `style={{ backgroundColor: product.color }}` cannot be tested by Vitest DOM; requires visual check | Navigate to `/issues`; verify each issue row shows a colored dot matching the product's color in Settings |
| Rate-limit banner shows correct countdown | CROSS-03 | Requires triggering real rate-limit response; not reproducible in unit tests | If rate limit occurs, banner should display "rate limited, retry in Xs" with numeric countdown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
