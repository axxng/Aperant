---
phase: 8
slug: rename-from-aperant-to-currents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `apps/web/vite.config.ts` (test projects section) |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | RENAME-01 | — | N/A | grep | `grep -rn "Aperant" apps/web/src/ && echo FAIL \|\| echo PASS` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | RENAME-02 | — | N/A | grep | `grep -n "aperant-auth" apps/web/src/ && echo FAIL \|\| echo PASS` | ✅ | ⬜ pending |
| 8-01-03 | 01 | 1 | RENAME-03 | — | N/A | unit | `cd apps/web && npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — this phase requires no new test files. Existing test infrastructure (143 tests / 18 files) covers all phase behaviors:
1. `grep -rn "Aperant" apps/web/src/` returning zero results
2. `npm test` remaining green (143/143)

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| localStorage key consistency | RENAME-02 | No automated test exists for localStorage key names | After changes: confirm `auth-store.ts` and `api-client.ts` both reference `currents-auth`; sign in and verify API calls succeed (no 401s) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
