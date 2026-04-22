---
phase: 08-rename-from-aperant-to-currents
plan: "02"
subsystem: apps/web
tags: [rename, i18n, docs, lockfile]
dependency_graph:
  requires: ["08-01"]
  provides: ["zero-aperant-in-web-i18n", "zero-aperant-in-web-docs", "lockfile-updated"]
  affects: ["apps/web/src/shared/i18n/", "apps/web/README.md", "apps/web/SPEC.md", "package-lock.json"]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - apps/web/src/shared/i18n/locales/en/common.json
    - apps/web/src/shared/i18n/locales/fr/common.json
    - apps/web/src/shared/i18n/locales/en/auth.json
    - apps/web/src/shared/i18n/locales/fr/auth.json
    - apps/web/src/shared/i18n/locales/en/settings.json
    - apps/web/src/shared/i18n/locales/fr/settings.json
    - apps/web/README.md
    - apps/web/SPEC.md
    - package-lock.json
decisions:
  - "Brand name 'Currents' used unchanged in French locale files (proper noun — not translated, per international software naming convention)"
  - "SPEC.md overview updated to 'GitHub Issues triage platform' replacing outdated 'multi-product backlog management platform' description"
  - "Root package-lock.json updated (not apps/web/package-lock.json which does not exist — workspace lock lives at repo root)"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-22T16:16:37Z"
  tasks_completed: 3
  files_modified: 9
---

# Phase 08 Plan 02: i18n Locale Files, Docs, and Lockfile Rename Summary

Replaced all "Aperant"/"aperant" occurrences in apps/web i18n locale files (6 files), documentation (README.md, SPEC.md), and regenerated the root package-lock.json workspace entry from `@aperant/web` to `@currents/web`. Test suite remains green at 143/143.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update all 6 i18n locale files (en/ + fr/ namespaces) | ff804ebe | en/common.json, fr/common.json, en/auth.json, fr/auth.json, en/settings.json, fr/settings.json |
| 2 | Update README.md and SPEC.md documentation files | a5319c1c | apps/web/README.md, apps/web/SPEC.md |
| 3 | Regenerate lockfile and validate full test suite | 940aa8e9 | package-lock.json |

## Changes Made

### Task 1: i18n Locale Files (6 files)

Exact string replacements — one per file:
- `en/common.json` line 2: `"appName": "Aperant"` → `"appName": "Currents"`
- `fr/common.json` line 2: `"appName": "Aperant"` → `"appName": "Currents"`
- `en/auth.json` line 4: `"welcome": "Welcome to Aperant"` → `"welcome": "Welcome to Currents"`
- `fr/auth.json` line 4: `"welcome": "Bienvenue sur Aperant"` → `"welcome": "Bienvenue sur Currents"`
- `en/settings.json` line 3: `"subtitle": "Configure your Aperant workspace"` → `"subtitle": "Configure your Currents workspace"`
- `fr/settings.json` line 3: `"subtitle": "Configurer votre espace de travail Aperant"` → `"subtitle": "Configurer votre espace de travail Currents"`

### Task 2: Documentation Files

**README.md** (6 replacements):
- H1 heading: `# Aperant Web` → `# Currents Web`
- Desktop app reference: `Aperant desktop app` → `Currents desktop app`
- Turso CLI examples: `aperant` → `currents` (3 occurrences: create, show, tokens create)
- Environment variable example URL: `libsql://aperant-yourorg.turso.io` → `libsql://currents-yourorg.turso.io`

**SPEC.md** (5+ replacements):
- H1 heading: `# Aperant Web Platform` → `# Currents Web Platform`
- Purpose line: `Aperant desktop app` → `Currents desktop app`
- Overview: `Aperant Web is a multi-product backlog management platform` → `Currents Web is a GitHub Issues triage platform`
- All `aperant-web` Turso DB examples → `currents` (4 occurrences across deploy section)

### Task 3: Lockfile Update

`npm install` from `apps/web/` updated the root `package-lock.json`:
- Workspace name entry: `@aperant/web` → `@currents/web`
- `node_modules/@aperant/web` symlink removed; `node_modules/@currents/web` symlink added

Note: `apps/web/package-lock.json` does not exist — the monorepo uses a single root lockfile.

## Verification Results

```
grep -rn "Aperant" apps/web/src/shared/i18n/   → zero results (PASS)
grep -rn "Aperant|aperant" apps/web/README.md   → zero results (PASS)
grep -rn "Aperant|aperant" apps/web/SPEC.md     → zero results (PASS)
grep "@aperant/web" package-lock.json           → zero results (PASS)
npm test (apps/web)                             → 143/143 tests passing (PASS)
```

## Deviations from Plan

### Auto-noted: root lockfile vs apps/web/package-lock.json

- **Found during:** Task 3
- **Issue:** Plan listed `apps/web/package-lock.json` as the file to commit, but this file does not exist. The monorepo uses a single root `package-lock.json` at the repo root.
- **Fix:** Staged and committed `package-lock.json` (root) instead — this is where npm workspaces stores the lock for all workspace packages.
- **Files modified:** `package-lock.json` (root)
- **Commit:** 940aa8e9

## Known Stubs

None — all string replacements wire through to UI render paths. No placeholder values remain.

## Threat Flags

None — no new endpoints, auth paths, or schema changes introduced. String replacements in locale JSON, documentation, and lockfile only.

## Self-Check: PASSED

- ff804ebe exists: `git log --oneline | grep ff804ebe` — confirmed
- a5319c1c exists: `git log --oneline | grep a5319c1c` — confirmed
- 940aa8e9 exists: `git log --oneline | grep 940aa8e9` — confirmed
- Zero Aperant in i18n: confirmed
- Zero Aperant/aperant in docs: confirmed
- 143/143 tests green: confirmed
