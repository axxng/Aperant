---
phase: quick-260423-etk
plan: "01"
subsystem: documentation
tags: [docs, local-dev, mock-services, readme]
dependency_graph:
  requires: []
  provides: [apps/web/README.md#local-development]
  affects: [developer-onboarding]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - apps/web/README.md
decisions:
  - "Inserted Local Development section after the existing Architecture heading to maintain logical flow (deployment → architecture → local dev)"
  - "Route 5 (triage batch) documented as using real DB logic — no difference from production, unlike the other 5 mock routes"
metrics:
  duration: "73s"
  completed: "2026-04-23"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260423-etk Plan 01: Local Development Documentation Summary

**One-liner:** Added comprehensive Local Development section to apps/web/README.md documenting mock API server, quick-start commands, all 6 intercepted routes, and 5 troubleshooting pitfalls.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Local Development section to apps/web/README.md | c22cffa0 | apps/web/README.md |

## What Was Built

The `apps/web/README.md` now contains a full `## Local Development` section (191 lines added) with:

- **How It Works** — ASCII diagram showing Vite → Express → mock middleware → real handlers flow
- **Quick Start** — env var table (3 vars) + exact 4-step bash commands in order (env setup, seed, API server, Vite frontend), with note on credentials not required and production warning
- **Seed Data** — describes all 4 seed artefact categories (1 admin user, 3 products, 8 tasks/product, 3 triage records/product)
- **Mock Routes** — all 6 routes documented with HTTP method, path, behavior description, JSON response shape block, and "vs. real API" diff note
- **Troubleshooting** — 5 pitfalls with bold problem name, cause, and fix

All pre-existing README sections (Deployment, Architecture, Features, Project Structure, Scripts, Testing, API Quick Reference) are preserved intact.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — documentation only; no code stubs introduced.

## Threat Flags

None — documentation changes only; no new trust boundaries or network endpoints introduced.

## Self-Check: PASSED

- `grep -n "## Local Development" apps/web/README.md` → line 72 found
- `grep -c "MOCK_SERVICES" apps/web/README.md` → 9 (exceeds minimum of 5)
- `grep "dev-server.ts" apps/web/README.md` → found
- `grep "seed.ts" apps/web/README.md` → found
- `grep "/api/auth/github" apps/web/README.md` → 5 matches (routes 1, 2, OAuth initiate arch diagram, callback arch diagram, troubleshooting)
- `grep "/api/github/repos" apps/web/README.md` → found (routes 3, 4, 6 and arch diagram)
- `grep "/api/triage" apps/web/README.md` → found (route 5 and arch diagram)
- `grep "Troubleshooting" apps/web/README.md` → found
- `grep "Deployment" apps/web/README.md` → found (existing section preserved)
- Commit c22cffa0 verified: `git log --oneline | grep c22cffa0` → found
