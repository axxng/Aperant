# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** A team can run a full triage session — browse issues from all connected repos, assign priority, leave notes, and promote the right ones to the backlog — entirely inside Currents.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-04-21 — Roadmap created; all 27 v1 requirements mapped across 6 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Rate-limit errors must surface typed `GitHubRateLimitError` — `githubFetch()` currently passes 403/429 through as generic errors with no header inspection
- Phase 1: `github_comment_id` + `comment_status` columns must be in the initial migration — comment posting is non-idempotent without them
- Phase 2–6: TanStack Query v5 handles client-side caching and pagination; no Octokit (adds cold-start weight)
- Phase 3: Cross-repo aggregation is server-side (`Promise.allSettled()` fan-out), not in the browser

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: Open question on default sort order (`sort=created` for stability vs `sort=updated` for recent activity) — validate with team before Phase 2 ships
- Phase 3: Cross-repo batch size (3–5 repos recommended) needs tuning after Phase 3 ships based on observed rate-limit behaviour
- Phase 5: Stale issue refresh strategy (fixed-time threshold vs cron timestamp) — decide during Phase 4 planning

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | TRIAGE-V2-01: Snooze with wake-up date | Deferred — requires reliable scheduler | Roadmap |
| v2 | TRIAGE-V2-02: Bulk triage | Deferred | Roadmap |
| v2 | NOTES-V2-01: Full comment thread display | Deferred — high API cost | Roadmap |
| v2 | DISC-V2-01: Duplicate issue detection | Deferred — requires AI layer | Roadmap |

## Session Continuity

Last session: 2026-04-21
Stopped at: Roadmap and STATE.md created; REQUIREMENTS.md traceability updated
Resume file: None
