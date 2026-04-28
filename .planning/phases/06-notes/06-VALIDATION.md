---
phase: 6
slug: notes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (multi-project) |
| **Config file** | `apps/web/vite.config.ts` (test section) |
| **Quick run command** | `cd apps/web && npx vitest run --project api` or `--project frontend` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command scoped to changed file
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TDD stubs — comment.test.ts | 01 | 0 | NOTES-01, NOTES-02 | unit (api) | `cd apps/web && npx vitest run --project api api/github/repos/\[owner\]/\[repo\]/issues/\[number\]/comment.test.ts` | ❌ Wave 0 | ⬜ pending |
| TDD stubs — triage.test.ts extension | 01 | 0 | NOTES-02 | unit (api) | `cd apps/web && npx vitest run --project api api/_lib/db/triage.test.ts` | ✅ extend | ⬜ pending |
| TDD stubs — IssueDetailPanel.test.tsx extension | 01 | 0 | NOTES-01, NOTES-03 | unit (frontend) | `cd apps/web && npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx` | ✅ extend | ⬜ pending |
| upsertTriageRecord extension | 02 | 1 | NOTES-02 | unit (api) | `cd apps/web && npx vitest run --project api api/_lib/db/triage.test.ts` | ✅ extend | ⬜ pending |
| comment.ts idempotency + per-user token | 02 | 1 | NOTES-01, NOTES-02 | unit (api) | `cd apps/web && npx vitest run --project api api/github/repos/\[owner\]/\[repo\]/issues/\[number\]/comment.test.ts` | ❌ Wave 0 | ⬜ pending |
| Textarea ui component | 03 | 1 | NOTES-01 | unit (frontend) | `cd apps/web && npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx` | N/A | ⬜ pending |
| NoteSection in IssueDetailPanel | 03 | 1 | NOTES-01, NOTES-03 | unit (frontend) | `cd apps/web && npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx` | ✅ extend | ⬜ pending |
| i18n keys + mock handler | 03 | 1 | NOTES-01 | manual | visual verification in dev env | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` — NEW: stubs for NOTES-01 (valid POST), NOTES-02 (idempotency guard returns `alreadyPosted`), NOTES-02 (saves `githubCommentId`), per-user token (D-04)
- [ ] Extend `apps/web/api/_lib/db/triage.test.ts` — add failing stubs for `upsertTriageRecord` with `githubCommentId` + `commentStatus` fields (NOTES-02 DB layer)
- [ ] Extend `apps/web/src/client/components/IssueDetailPanel.test.tsx` — add failing stubs for NOTES-01 (textarea renders, mutation fires), NOTES-03 (onSuccess clears textarea + toast, onError preserves text + toast)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Success toast "Note posted to GitHub" visible | NOTES-03 | Toast rendering requires real DOM + dev server | Run with `MOCK_SERVICES=true`, open issue panel, type note, click Post Note, verify toast appears |
| Button transitions to "Sent" for 2s then resets | NOTES-03 | Timer-based state transition hard to assert reliably in unit tests | Same as above — observe button state change visually |
| Already-posted retry shows same success UX | NOTES-02 | Integration path through DB idempotency guard | Post a note, refresh page, post again — confirm only one GitHub comment created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
