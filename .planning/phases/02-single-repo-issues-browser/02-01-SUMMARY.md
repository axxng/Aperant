---
phase: 02-single-repo-issues-browser
plan: "01"
subsystem: testing
tags: [vitest, zod, tailwindcss, tanstack-query, react-markdown, remark-gfm]

# Dependency graph
requires: []
provides:
  - "@tanstack/react-query dependency installed"
  - "react-markdown dependency installed"
  - "remark-gfm dependency installed"
  - "@tailwindcss/typography dependency installed and registered in globals.css"
  - "issues.test.ts — 7-test Nyquist stub for BROWSE-01 through BROWSE-04, BROWSE-08"
  - "labels.test.ts — 4-test Nyquist stub in RED state awaiting labels.ts creation"
affects:
  - "02-02 (labels endpoint — test stubs ready to go green)"
  - "02-03 (issues browser UI — react-query and react-markdown available)"
  - "02-06 (issue detail panel — typography plugin registered)"

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-query (client-side caching and pagination)"
    - "react-markdown (markdown body rendering)"
    - "remark-gfm (GitHub Flavored Markdown plugin)"
    - "@tailwindcss/typography (prose utility classes)"
  patterns:
    - "Vitest spy pattern: vi.clearAllMocks() in beforeEach prevents call accumulation across tests"
    - "Rate-limit mock pattern: mock fetch to return 429 response — githubFetch converts to GitHubRateLimitError"
    - "Nyquist RED state: labels.test.ts uses dynamic import with 501 fallback so test runner stays green for other files"

key-files:
  created:
    - "apps/web/api/github/repos/[owner]/[repo]/issues.test.ts"
    - "apps/web/api/github/repos/[owner]/[repo]/labels.test.ts"
  modified:
    - "apps/web/package.json"
    - "apps/web/src/client/styles/globals.css"
    - "package-lock.json"

key-decisions:
  - "All four packages installed in production dependencies (not devDependencies) — typography generates CSS at build time"
  - "@plugin '@tailwindcss/typography' added after @import 'tailwindcss' directive (Tailwind v4 plugin syntax)"
  - "vi.clearAllMocks() added to beforeEach to prevent fetch spy call accumulation across test cases"
  - "Rate-limit test uses fetch returning 429 status (not mockRejectedValue) — githubFetch handles 429→GitHubRateLimitError conversion"

patterns-established:
  - "Nyquist contract: test stubs created before implementation, RED for missing features, GREEN for existing handlers"
  - "Dynamic import fallback: labels.test.ts uses import().catch() so missing-file fails individual tests, not entire suite"

requirements-completed:
  - BROWSE-01
  - BROWSE-02
  - BROWSE-03
  - BROWSE-04
  - BROWSE-08

# Metrics
duration: 8min
completed: 2026-04-21
---

# Phase 02 Plan 01: Foundation Dependencies and Nyquist Test Stubs Summary

**Four npm dependencies installed and two test stub files created establishing the automated feedback loop for all Phase 2 plans**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-21T09:22:00Z
- **Completed:** 2026-04-21T09:30:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed @tanstack/react-query, react-markdown, remark-gfm, and @tailwindcss/typography in production dependencies
- Registered @tailwindcss/typography via `@plugin` directive in globals.css (Tailwind v4 syntax); build confirms prose classes generated
- Created issues.test.ts with 7 tests (all GREEN) covering BROWSE-01 through BROWSE-04, BROWSE-08 against the existing issues handler
- Created labels.test.ts with 4 tests in intentional RED state — labels.ts does not exist yet; dynamic import fallback prevents suite-level crashes

## Task Commits

1. **Task 1: Install dependencies and register typography plugin** - `b3340f58` (chore)
2. **Task 2: Create failing test stubs (Nyquist contract)** - `bc0ad907` (test)

## Files Created/Modified
- `apps/web/package.json` — Added 4 production dependencies
- `apps/web/src/client/styles/globals.css` — Added `@plugin "@tailwindcss/typography"` after `@import "tailwindcss"`
- `package-lock.json` — Updated lockfile (103 packages added)
- `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` — 7-test Nyquist stub, all GREEN
- `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts` — 4-test Nyquist stub in RED state

## Decisions Made
- All four packages in `dependencies` (not `devDependencies`) — @tailwindcss/typography generates CSS at build time via Tailwind plugin chain
- Tailwind v4 uses `@plugin` CSS at-rule (not tailwind.config.js) to register plugins
- `vi.clearAllMocks()` added to `beforeEach` in issues.test.ts — spy call accumulation across tests caused labels/assignee URL checks to read stale calls from prior tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test spy call accumulation causing false URL assertion failures**
- **Found during:** Task 2 (Create failing test stubs)
- **Issue:** The `beforeEach` hook called `vi.spyOn(globalThis, 'fetch')` without clearing previous mock state. Tests checking `mock.calls[0]?.[0]` for the GitHub API URL were reading the first call from the PREVIOUS test, not the current test. The labels/assignee URL parameter tests both failed with the URL from an earlier test (which had no labels in the URL).
- **Fix:** Added `vi.clearAllMocks()` at the top of `beforeEach` to reset all mock state between tests
- **Files modified:** `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts`
- **Verification:** All 7 issues tests GREEN; labels/assignee URL assertions now verify the correct call
- **Committed in:** `bc0ad907` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed 429 rate-limit test mock approach**
- **Found during:** Task 2 (Create failing test stubs)
- **Issue:** The plan's provided test code used `mockRejectedValueOnce(Object.assign(new Error(...), { constructor: { name: 'GitHubRateLimitError' } }))`. The handler catches errors with `error instanceof GitHubRateLimitError` which checks prototype chain, not the `constructor.name` property. The mock error was not an actual `GitHubRateLimitError` instance, so the handler fell through to the generic 500 catch.
- **Fix:** Changed the mock to `mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }))` — returning a real 429 HTTP response that `githubFetch` converts into a `GitHubRateLimitError` via its built-in rate-limit detection
- **Files modified:** `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts`
- **Verification:** 429 test passes — handler correctly returns status 429 with retryAfter
- **Committed in:** `bc0ad907` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test stubs)
**Impact on plan:** Both fixes were necessary for the Nyquist contract — tests that always pass regardless of handler behavior would not provide useful feedback. No scope creep.

## Issues Encountered
- @tailwindcss/typography installed without compatibility errors (Open Question #2 from RESEARCH.md resolved — the plugin IS compatible with Tailwind v4)
- Build succeeds with prose utilities generated

## Known Stubs
None — no stubs exist that prevent the plan's goal from being achieved. The labels.test.ts RED state is intentional and documented in plan.

## Threat Flags
None — this plan only adds npm dependencies and test files. No new network endpoints, auth paths, or schema changes introduced.

## Next Phase Readiness
- Wave 1 plans (02-02 through 02-05) can proceed — all four dependencies available, test infrastructure established
- labels.test.ts provides the automated feedback loop for Plan 02-02 (labels endpoint)
- issues.test.ts provides regression protection for the existing issues handler throughout Phase 2

---
*Phase: 02-single-repo-issues-browser*
*Completed: 2026-04-21*
