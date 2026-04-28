---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.0` |
| **Config file** | `apps/web/vitest.config.ts` (Wave 0 creates this) |
| **Quick run command** | `cd apps/web && npx vitest run api/_lib/github.test.ts` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run api/_lib/github.test.ts`
- **After every plan wave:** Run `cd apps/web && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | INFRA-01 | — | `GitHubRateLimitError` thrown on 429 | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | INFRA-01 | — | `GitHubRateLimitError` thrown on 403 + remaining=0 | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | INFRA-01 | — | `GitHubRateLimitError` thrown on secondary rate limit (retry-after header) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | INFRA-01 | — | `retryAfter` derived from `x-ratelimit-reset` (primary limit) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 0 | INFRA-01 | — | `retryAfter` derived from `retry-after` header (secondary limit) | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 0 | INFRA-01 | — | `retryAfter` falls back to 60 when both headers absent | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 0 | INFRA-01 | — | Non-rate-limit 403 (auth failure) does NOT throw `GitHubRateLimitError` | unit | `cd apps/web && npx vitest run api/_lib/github.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 0 | INFRA-02 | — | `getTriageRecord()` returns `null` when no record exists | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 0 | INFRA-02 | — | `upsertTriageRecord()` creates new record | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 0 | INFRA-02 | — | `upsertTriageRecord()` updates existing record (partial update preserves untouched fields) | unit | `cd apps/web && npx vitest run api/_lib/db/triage.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` — Vitest configuration for the `apps/web` workspace
- [ ] `apps/web/package.json` — add `"test": "vitest run"` and `"test:watch": "vitest"` scripts
- [ ] `apps/web/api/_lib/github.test.ts` — unit tests for `GitHubRateLimitError` detection (covers INFRA-01)
- [ ] `apps/web/api/_lib/db/triage.test.ts` — unit tests for `getTriageRecord` and `upsertTriageRecord` (covers INFRA-02); requires `vi.mock('@libsql/client')` since tests run without live Turso

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GET `/api/triage/:owner/:repo/:number` returns 200 default state for unknown issue | INFRA-02 | Requires live Turso + deployed API | `curl -H "Authorization: Bearer <token>" https://<host>/api/triage/owner/repo/1` → `{"isTriaged":false,"priority":null,"githubCommentId":null,"commentStatus":null}` |
| PUT `/api/triage/:owner/:repo/:number` upserts correctly | INFRA-02 | Requires live Turso + deployed API | `curl -X PUT -H "Authorization: Bearer <token>" -d '{"isTriaged":true,"priority":"high"}' https://<host>/api/triage/owner/repo/1` → 200 with updated record |
| Existing issues route still works after filter extension | INFRA-01 | Integration with GitHub API | `curl -H "Authorization: Bearer <token>" https://<host>/api/github/repos/owner/repo/issues?labels=bug&assignee=user` → 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
