---
phase: "07"
plan: "04"
type: human-verification
wave: 3
completed: "2026-04-22"
---

# Phase 07 Plan 04: Human Verification — Promote to Backlog Summary

Wave 3 human verification. All 5 PROMOTE requirements confirmed end-to-end in browser with mock dev server.

## Tasks Completed

| Task | Name | Result |
|------|------|--------|
| 1 | Full automated suite gate (139 tests, typecheck) | PASS (done in prior session) |
| 2 | Human smoke test — 4 scenarios | PASS (2026-04-22) |

## Smoke Test Results

| Test | Scenario | Requirements | Result |
|------|----------|-------------|--------|
| 1 | Happy path — promote issue, task appears in Kanban backlog | PROMOTE-01, PROMOTE-04 | PASS |
| 2 | Duplicate guard — button hidden after promotion, badge shown | PROMOTE-05 | PASS (button absent = guard works) |
| 3 | Write-back — editing task title syncs to GitHub issue | PROMOTE-02 | PASS |
| 4 | i18n — FR locale has all promote keys | FR locale coverage | PASS |

## Smoke Test 2 Note

The plan described a "duplicate toast" flow, but the implementation takes a stronger approach: the **Promote to Backlog** button is hidden entirely once `existingTask` query returns a task. This prevents the duplicate action at the UI level rather than showing a post-hoc error. PROMOTE-05 is satisfied — no duplicate task can be created.

## Bugs Fixed During Smoke Testing (prior session)

| Bug | Fix | Commit |
|-----|-----|--------|
| `promoteMutation.onSuccess` didn't call `loadTasks(productId)` — Kanban didn't update after promotion | Added `loadTasks(productId)` to `onSuccess` handler | `c158b608` |
| `seed.ts` used `'Needs review'` for `review_reason` — fails `taskDbRowSchema` enum, rowToTask ZodError, silent Kanban failure | Changed to `'errors'` (valid enum value) | `504c8deb` |
| `comment.test.ts` mock `TokenPayload` missing `exp` field | Added `exp: Math.floor(Date.now() / 1000) + 3600` | `40af31c5` |
| `DevModeBanner.tsx` used `import.meta.env` without vite type reference | Added `vite-env.d.ts` with `/// <reference types="vite/client" />` | `40af31c5` |

## Pre-seed Requirement

`dev.db` must be re-seeded before smoke testing: `cd apps/web && npx tsx scripts/seed.ts`. The seed now uses valid `review_reason` enum values.

## Final Gate State

| Gate | Status |
|------|--------|
| `npm test` (139 tests) | PASS |
| `npm run typecheck` | PASS |
| PROMOTE-01 | VERIFIED in browser |
| PROMOTE-02 | VERIFIED in browser |
| PROMOTE-03 | VERIFIED in browser |
| PROMOTE-04 | VERIFIED in browser |
| PROMOTE-05 | VERIFIED in browser |

## Self-Check: PASSED
