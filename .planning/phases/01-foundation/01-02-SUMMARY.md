---
phase: 01-foundation
plan: 02
subsystem: database
tags: [turso, libsql, sqlite, migration, triage, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "011_issue_triage migration in MIGRATIONS array (client.ts)"
  - "issue_triage table schema with all 8 columns including github_comment_id and comment_status"
  - "TriageRecord TypeScript interface (triage.ts)"
  - "getTriageRecord() parameterized SELECT helper"
  - "upsertTriageRecord() ON CONFLICT DO UPDATE with COALESCE partial update semantics"
affects: [01-03, phase-03, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rowToTriage() mapper: convert raw libsql rows to typed TriageRecord interface"
    - "COALESCE in ON CONFLICT DO UPDATE for partial/sparse upsert"
    - "TDD with vi.mock('./client.js') to unit-test DB helpers without a live DB"

key-files:
  created:
    - apps/web/api/_lib/db/triage.ts
    - apps/web/api/_lib/db/triage.test.ts
  modified:
    - apps/web/api/_lib/db/client.ts

key-decisions:
  - "COALESCE(excluded.field, field) in DO UPDATE SET enables partial updates: callers only pass fields they want to change; others are preserved"
  - "github_comment_id + comment_status included in initial migration per decision in STATE.md — comment posting is non-idempotent without them"
  - "Composite PRIMARY KEY (github_repo, github_issue_number) — no UUID; issue identity is the natural key"

patterns-established:
  - "Triage DB helper pattern: import getClient from client.js, rowToX mapper, typed interface, parameterized queries only"
  - "Unit test pattern for DB helpers: vi.mock('./client.js') with mockExecute.mockResolvedValueOnce for each query"

requirements-completed:
  - INFRA-02

# Metrics
duration: 10min
completed: 2026-04-21
---

# Phase 1 Plan 02: Triage DB Migration and Helpers Summary

**issue_triage table migration (011) with TriageRecord interface and COALESCE-based upsert helpers backed by 3 passing TDD unit tests**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-21T06:20:00Z
- **Completed:** 2026-04-21T06:22:02Z
- **Tasks:** 1 (TDD task with RED/GREEN cycle)
- **Files modified:** 3

## Accomplishments
- Appended `011_issue_triage` migration to MIGRATIONS array in `client.ts` — includes all 8 required columns: `github_repo`, `github_issue_number`, `is_triaged`, `priority`, `github_comment_id`, `comment_status`, `created_at`, `updated_at` with composite PRIMARY KEY
- Created `triage.ts` exporting `TriageRecord` interface, `getTriageRecord()`, and `upsertTriageRecord()` — all using parameterized args to prevent SQL injection (T-02-01 mitigated)
- `upsertTriageRecord()` uses `ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET` with `COALESCE` semantics so callers can send partial updates without overwriting unset fields
- All 3 unit tests pass (RED → GREEN TDD cycle); TypeScript compile check passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for triage DB helpers** - `1b65c2dc` (test)
2. **Task 1 (GREEN): 011_issue_triage migration + triage DB helpers** - `a6701fb9` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD task split into test commit (RED) and implementation commit (GREEN)._

## Files Created/Modified
- `apps/web/api/_lib/db/triage.ts` — TriageRecord interface + getTriageRecord() + upsertTriageRecord()
- `apps/web/api/_lib/db/triage.test.ts` — 3 unit tests with mocked getClient()
- `apps/web/api/_lib/db/client.ts` — 011_issue_triage migration appended to MIGRATIONS array

## Decisions Made
- Used `COALESCE(excluded.is_triaged, is_triaged)` in DO UPDATE SET for partial update semantics — caller only passes fields to change; DB preserves others
- `github_comment_id` and `comment_status` included in migration per STATE.md decision: comment posting is non-idempotent without tracking the posted comment ID
- Composite PRIMARY KEY `(github_repo, github_issue_number)` chosen over UUID — natural identity for a triage record keyed to a GitHub issue

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- npm dependencies were not installed in the worktree; ran `npm install` before tests could execute (Rule 3 — blocking, resolved inline)

## User Setup Required
None - no external service configuration required. Migration runs automatically via `ensureDb()` on first request.

## Next Phase Readiness
- `getTriageRecord()` and `upsertTriageRecord()` are ready to import in Plan 03 triage route handlers
- `issue_triage` table schema is finalized — Phase 5 notes (github_comment_id, comment_status) columns already present
- Existing migrations 001–010 are unmodified and verified

---
*Phase: 01-foundation*
*Completed: 2026-04-21*
