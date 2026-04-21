---
phase: 01-foundation
plan: "01"
subsystem: github-api
tags: [vitest, rate-limit, error-handling, tdd, github]
dependency_graph:
  requires: []
  provides: [GitHubRateLimitError, githubFetch-rate-limit-detection, vitest-infrastructure]
  affects: [apps/web/api/_lib/github.ts]
tech_stack:
  added: [vitest@4.1.0]
  patterns: [TDD RED/GREEN, typed-error-classes, header-based-rate-limit-detection]
key_files:
  created:
    - apps/web/api/_lib/github.test.ts
  modified:
    - apps/web/api/_lib/github.ts
    - apps/web/vite.config.ts
    - apps/web/package.json
decisions:
  - "429 responses always throw GitHubRateLimitError regardless of headers (per test spec)"
  - "403 throws only when x-ratelimit-remaining=0 or retry-after header present (auth failures pass through)"
  - "retryAfter priority: retry-after header > x-ratelimit-reset timestamp > 60s fallback"
metrics:
  duration: "2m 42s"
  completed_date: "2026-04-21"
  tasks_completed: 1
  files_modified: 4
---

# Phase 1 Plan 01: Vitest Infrastructure + GitHubRateLimitError Summary

**One-liner:** Vitest test infrastructure wired to vite.config.ts with typed `GitHubRateLimitError` class and rate-limit detection logic in `githubFetch()` covering primary (429/403+remaining=0) and secondary (retry-after) limits.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for GitHubRateLimitError | ad1af2d0 | apps/web/api/_lib/github.test.ts |
| 1 (GREEN) | GitHubRateLimitError class + githubFetch rate-limit detection | 8e43ff4a | apps/web/api/_lib/github.ts, vite.config.ts, package.json |
| 1 (support) | Root package-lock.json after npm install | 55082947 | package-lock.json |

## What Was Built

- **`GitHubRateLimitError`** — typed error class extending `Error` with `readonly retryAfter: number` field and `name = 'GitHubRateLimitError'`
- **`githubFetch()` rate-limit detection** — inspects response status and headers before returning; throws `GitHubRateLimitError` on rate-limited responses; non-rate-limit 403s (auth failures) pass through as normal responses
- **Vitest test config** — `test` block added to `vite.config.ts` with `globals: true`, `environment: 'node'`, `include: ['api/**/*.test.ts']`
- **Test scripts** — `"test": "vitest run"` and `"test:watch": "vitest"` added to `package.json`
- **7 unit tests** covering: GitHubRateLimitError instanceof Error, 429 detection, 403+remaining=0, secondary limits (retry-after), retryAfter from x-ratelimit-reset, fallback to 60, auth failure pass-through

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 429-with-no-headers not throwing GitHubRateLimitError**
- **Found during:** GREEN phase test run (1 of 7 tests failing)
- **Issue:** Plan's logic condition `isPrimaryLimit || isSecondaryLimit` did not cover a bare 429 with no rate-limit headers. A 429 with no headers had `remaining=null` (not '0') and no retry-after header, so neither condition was true and the response was returned normally.
- **Fix:** Added `is429 = response.status === 429` flag to the condition: `if (isPrimaryLimit || isSecondaryLimit || is429)`. This ensures all 429 responses throw, while 403 still only throws when rate-limit headers are present.
- **Files modified:** `apps/web/api/_lib/github.ts`
- **Commit:** 8e43ff4a

### Deviation: npm install required before tests (Rule 3 - Blocking)

- **Found during:** First RED phase test run
- **Issue:** `npx vitest run` failed with `ERR_MODULE_NOT_FOUND` — `vite` and plugin packages not installed in worktree
- **Fix:** Ran `npm install` in `apps/web/` before proceeding with RED phase tests
- **Impact:** `package-lock.json` updated (committed separately at 55082947)

## TDD Gate Compliance

- RED gate: `test(01-01)` commit ad1af2d0 — 6/7 tests failing (GitHubRateLimitError not yet exported)
- GREEN gate: `feat(01-01)` commit 8e43ff4a — all 7 tests passing
- REFACTOR gate: not required (implementation was clean)

## Known Stubs

None — all rate-limit detection logic is fully wired and exercised by tests.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. `parseInt(..., 10)` on malformed `retry-after` header returns NaN; `Math.max(0, NaN)` = 0, providing a safe fallback as documented in T-01-03.

## Self-Check: PASSED

All files exist, all commits verified, all acceptance criteria met:
- github.test.ts created with 7 tests
- github.ts: GitHubRateLimitError exported, retryAfter field, Math.max(0 clamping, throw present
- vite.config.ts: test block with include pattern
- package.json: test and test:watch scripts; existing scripts (dev, build, typecheck, lint, lint:fix) preserved
- Commits ad1af2d0 (RED), 8e43ff4a (GREEN) verified in git log
