---
phase: 08-rename-from-aperant-to-currents
plan: "01"
subsystem: apps/web
tags: [rename, branding, localStorage, auth, package]
dependency_graph:
  requires: []
  provides: [currents-auth localStorage key, @currents/web package name, Currents HTML title, Currents CSS comment]
  affects: [auth-store.ts, api-client.ts, package.json, index.html, globals.css]
tech_stack:
  added: []
  patterns: [paired localStorage key rename]
key_files:
  created: []
  modified:
    - apps/web/src/client/stores/auth-store.ts
    - apps/web/src/client/lib/api-client.ts
    - apps/web/package.json
    - apps/web/index.html
    - apps/web/src/client/styles/globals.css
decisions:
  - Paired localStorage key (auth-store.ts + api-client.ts) updated atomically in a single task to prevent divergence causing silent 401 errors
  - npm install not run — lockfile regeneration deferred to Plan 02 Task 3 as specified
metrics:
  duration: "64s"
  completed: "2026-04-22T16:12:40Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 08 Plan 01: Rename Aperant to Currents (Code Layer) Summary

Renamed all Aperant code-layer references to Currents across five files: paired localStorage key in auth-store.ts and api-client.ts, package name in package.json, HTML page title in index.html, and CSS design system comment in globals.css.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rename paired localStorage key | 8e276c49 | auth-store.ts, api-client.ts |
| 2 | Rename package name, HTML title, CSS comment | e54c1030 | package.json, index.html, globals.css |

## Changes Made

### Task 1 — Paired localStorage key rename (commit 8e276c49)

- `apps/web/src/client/stores/auth-store.ts`: `{ name: 'aperant-auth' }` → `{ name: 'currents-auth' }`
- `apps/web/src/client/lib/api-client.ts`: `localStorage.getItem('aperant-auth')` → `localStorage.getItem('currents-auth')`

These two files share a magic string key for Zustand's localStorage persistence. Updated atomically to ensure they always agree — divergence would cause every API call to return 401 silently.

Known side-effect: all currently-authenticated browser sessions will be silently logged out on next page load (old `aperant-auth` key is orphaned in localStorage). Acceptable — JWT sessions are short-lived.

### Task 2 — Package name, HTML title, CSS comment (commit e54c1030)

- `apps/web/package.json`: `"name": "@aperant/web"` → `"name": "@currents/web"`
- `apps/web/index.html`: `<title>Auto Claude — Multi-Product Backlog</title>` → `<title>Currents</title>`
- `apps/web/src/client/styles/globals.css`: `/* Aperant Web - Design System */` → `/* Currents - Design System */`

## Verification

```
PASS: no aperant-auth found in apps/web/src/
PASS: package name is @currents/web
PASS: HTML title is Currents
PASS: CSS comment is Currents - Design System
PASS: 143/143 tests passing
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All five changes are string literal renames with no data flow or UI rendering implications.

## Threat Flags

None. Per plan threat model: zero new attack surfaces, no new code paths, no new endpoints or data flows introduced.

## Self-Check: PASSED

- `apps/web/src/client/stores/auth-store.ts` — modified, contains `currents-auth`
- `apps/web/src/client/lib/api-client.ts` — modified, contains `currents-auth`
- `apps/web/package.json` — modified, contains `@currents/web`
- `apps/web/index.html` — modified, contains `<title>Currents</title>`
- `apps/web/src/client/styles/globals.css` — modified, contains `/* Currents - Design System */`
- Commit 8e276c49 exists (Task 1)
- Commit e54c1030 exists (Task 2)
- 143/143 tests green
