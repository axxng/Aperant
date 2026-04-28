---
phase: 2
slug: single-repo-issues-browser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `apps/web/vite.config.ts` (`test` section) |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~10 seconds |

Note: existing test environment is `node`, targeting `api/**/*.test.ts` only. Frontend component tests (BROWSE-05, BROWSE-06) are manual-only — no jsdom configured.

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | 01 | 0 | BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-08 | — | N/A | unit | `cd apps/web && npm test -- api/github/repos/\[owner\]/\[repo\]/issues.test.ts` | ❌ W0 | ⬜ pending |
| 2-W0-02 | 01 | 0 | BROWSE-07 | — | N/A | unit | `cd apps/web && npm test -- api/github/repos/\[owner\]/\[repo\]/labels.test.ts` | ❌ W0 | ⬜ pending |
| 2-labels-api | labels | 1 | BROWSE-03, BROWSE-07 | T-labels-auth, T-labels-path | `authenticateRequest()` + `githubOwnerRepoSchema` applied | unit | `cd apps/web && npm test -- api/github/repos/\[owner\]/\[repo\]/labels.test.ts` | ❌ W0 | ⬜ pending |
| 2-issues-api | issues | 1 | BROWSE-01, BROWSE-02, BROWSE-04, BROWSE-08 | T-issues-params | Params validated via existing schema | unit | `cd apps/web && npm test -- api/github/repos/\[owner\]/\[repo\]/issues.test.ts` | ❌ W0 | ⬜ pending |
| 2-deps | deps | 0 | — | — | N/A | build | `cd apps/web && npm run build` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/github/repos/[owner]/[repo]/issues.test.ts` — unit tests covering BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-08 (follows existing `api/_lib/github.test.ts` pattern)
- [ ] `api/github/repos/[owner]/[repo]/labels.test.ts` — unit tests covering BROWSE-07 (follows same pattern)

*Frontend component tests (BROWSE-05, BROWSE-06) are not feasible under current node test environment — moved to Manual-Only Verifications.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Client-side title search filters issues in the loaded list | BROWSE-05 | No jsdom in test config — React components untestable | 1. Open /products/:id/issues. 2. Type a keyword in the search box. 3. Verify only matching issue titles remain visible. |
| Clicking an issue opens the slide-in detail panel with rendered Markdown | BROWSE-06 | Component test requires jsdom | 1. Open issues list. 2. Click any issue row. 3. Verify panel slides in showing title, state badge, labels, assignee, date, and rendered Markdown body. |
| Clicking another row replaces detail panel content without closing | BROWSE-06 | Component test requires jsdom | 1. Open detail panel. 2. Click a different row. 3. Verify panel shows new issue without close/reopen. |
| "View on GitHub" link opens the issue URL in a new tab | BROWSE-08 | Component test requires jsdom | 1. Open detail panel. 2. Click "View on GitHub". 3. Verify correct issue URL opens in new tab. |
| Filter state persists in URL (shareable links) | BROWSE-03, BROWSE-04 | Browser-level test | 1. Set label and assignee filters. 2. Copy URL. 3. Open URL in new tab. 4. Verify same filters are active. |
| Load More appends next 50 issues without replacing list | BROWSE-07 | Component test requires jsdom | 1. Load issues. 2. Click "Load More". 3. Verify new issues are appended (not replaced) and "Load More" disappears when hasMore=false. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
