---
phase: 08-rename-from-aperant-to-currents
verified: 2026-04-23T00:00:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 08: Rename from "Aperant" to "Currents" Verification Report

**Phase Goal:** Every occurrence of "Aperant" in apps/web/ is replaced with "Currents" — package name, localStorage key, i18n strings, HTML title, CSS comment, and documentation files — completing the branding rename
**Verified:** 2026-04-23T00:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Zustand persist key in auth-store.ts is 'currents-auth' | VERIFIED | Line 64: `{ name: 'currents-auth' }` |
| 2 | The localStorage.getItem() call in api-client.ts reads 'currents-auth' | VERIFIED | Line 10: `localStorage.getItem('currents-auth')` |
| 3 | The package.json name is '@currents/web' | VERIFIED | Line 2: `"name": "@currents/web"` |
| 4 | The HTML page title is 'Currents' | VERIFIED | Line 6: `<title>Currents</title>` |
| 5 | The CSS file comment header reads 'Currents - Design System' | VERIFIED | Line 4: `/* Currents - Design System */` |
| 6 | No occurrence of 'aperant-auth' remains in apps/web/src/ | VERIFIED | `grep -rn "aperant-auth" apps/web/src/` returns zero results |
| 7 | No occurrence of 'Aperant' or '@aperant' remains in apps/web/src/ or apps/web/package.json | VERIFIED | Broad grep across .ts, .tsx, .json, .html, .css returns zero results |
| 8 | en/common.json appName value is 'Currents' | VERIFIED | Line 2: `"appName": "Currents"` |
| 9 | fr/common.json appName value is 'Currents' | VERIFIED | Line 2: `"appName": "Currents"` |
| 10 | en/auth.json welcome value is 'Welcome to Currents' | VERIFIED | Line 4: `"welcome": "Welcome to Currents"` |
| 11 | fr/auth.json welcome value is 'Bienvenue sur Currents' | VERIFIED | Line 4: `"welcome": "Bienvenue sur Currents"` |
| 12 | en/settings.json subtitle value is 'Configure your Currents workspace' | VERIFIED | Line 3: `"subtitle": "Configure your Currents workspace"` |
| 13 | fr/settings.json subtitle value is 'Configurer votre espace de travail Currents' | VERIFIED | Line 3: `"subtitle": "Configurer votre espace de travail Currents"` |
| 14 | No occurrence of 'Aperant' remains in apps/web/src/shared/i18n/ | VERIFIED | `grep -rn "Aperant" apps/web/src/shared/i18n/` returns zero results |
| 15 | README.md heading is '# Currents Web' | VERIFIED | Line 1: `# Currents Web` |
| 16 | No occurrence of 'Aperant' or 'aperant' remains in apps/web/README.md or apps/web/SPEC.md | VERIFIED | Both files return zero results for case-sensitive grep |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/client/stores/auth-store.ts` | Zustand persist key rename | VERIFIED | Contains `{ name: 'currents-auth' }` at line 64 |
| `apps/web/src/client/lib/api-client.ts` | localStorage key read rename | VERIFIED | Contains `localStorage.getItem('currents-auth')` at line 10 |
| `apps/web/package.json` | Package name rename | VERIFIED | Contains `"name": "@currents/web"` at line 2 |
| `apps/web/index.html` | HTML page title rename | VERIFIED | Contains `<title>Currents</title>` at line 6 |
| `apps/web/src/client/styles/globals.css` | CSS comment rename | VERIFIED | Contains `/* Currents - Design System */` at line 4 |
| `apps/web/src/shared/i18n/locales/en/common.json` | English app name brand string | VERIFIED | Contains `"appName": "Currents"` |
| `apps/web/src/shared/i18n/locales/fr/common.json` | French app name brand string | VERIFIED | Contains `"appName": "Currents"` |
| `apps/web/src/shared/i18n/locales/en/auth.json` | English welcome string | VERIFIED | Contains `"welcome": "Welcome to Currents"` |
| `apps/web/src/shared/i18n/locales/fr/auth.json` | French welcome string | VERIFIED | Contains `"welcome": "Bienvenue sur Currents"` |
| `apps/web/src/shared/i18n/locales/en/settings.json` | English settings subtitle | VERIFIED | Contains `"subtitle": "Configure your Currents workspace"` |
| `apps/web/src/shared/i18n/locales/fr/settings.json` | French settings subtitle | VERIFIED | Contains `"subtitle": "Configurer votre espace de travail Currents"` |
| `apps/web/README.md` | Documentation rename | VERIFIED | Heading is `# Currents Web`; zero Aperant/aperant occurrences |
| `apps/web/SPEC.md` | Documentation rename | VERIFIED | Zero Aperant/aperant occurrences |
| `package-lock.json` (root) | Lockfile workspace entry updated | VERIFIED | `@aperant/web` absent; `@currents/web` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/client/stores/auth-store.ts` | `apps/web/src/client/lib/api-client.ts` | Shared localStorage key string `currents-auth` must be identical | WIRED | Both files contain `currents-auth`; strings are identical |
| `apps/web/src/shared/i18n/locales/en/common.json` | `apps/web/src/shared/i18n/locales/fr/common.json` | CLAUDE.md mandates both en/ and fr/ updated simultaneously | WIRED | Both files contain `"appName": "Currents"` |

### Data-Flow Trace (Level 4)

Not applicable — all changes are string literal renames with no new data flow introduced. Modified artifacts are string values (localStorage key names, JSON strings, HTML/CSS text), not components that render dynamic data from new sources.

### Behavioral Spot-Checks

Step 7b: SKIPPED — this phase makes no runnable code changes (string literal renames only). No API routes, components, or modules introduced. The test suite (143/143) was confirmed green in the summary and commit 940aa8e9.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RENAME-01 | 08-01, 08-02 | Roadmap-only ID: code-layer rename (localStorage key, package name, HTML title, CSS comment) + i18n rename | SATISFIED | All target strings confirmed changed in actual files |
| RENAME-02 | 08-01 | Roadmap-only ID: paired localStorage key rename (auth-store.ts + api-client.ts must match) | SATISFIED | Both files contain `currents-auth`; key link verified identical |
| RENAME-03 | 08-02 | Roadmap-only ID: documentation rename (README.md, SPEC.md) | SATISFIED | Zero Aperant/aperant occurrences in both files |

**Note:** RENAME-01, RENAME-02, RENAME-03 are not defined in REQUIREMENTS.md — they are roadmap-internal IDs for Phase 08 only. REQUIREMENTS.md tracks the functional requirements (AUTH, BROWSE, CROSS, TRIAGE, NOTES, PROMOTE, INFRA). This is expected: branding rename is cross-cutting housekeeping, not a user-facing functional requirement. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/client/lib/api-client.ts` | 11, 15 | `return null` | INFO | Legitimate error-handling in `getAuthToken()` — returns null when localStorage entry absent or JSON unparseable. Not a stub; function is wired to a proper try/catch with a real `localStorage.getItem()` call. |

No blockers or warnings found. The `return null` occurrences are correct defensive programming, not stubs.

### Human Verification Required

None. All must-haves for this phase are string literal renames verifiable by grep. No visual appearance, user flow, real-time behavior, or external service integration introduced.

### Gaps Summary

No gaps. All 16 must-have truths verified against the actual codebase. All 5 commits from Plan 01 (8e276c49, e54c1030) and Plan 02 (ff804ebe, a5319c1c, 940aa8e9) confirmed present in git log. Broad scan of apps/web/ for any remaining "Aperant"/"aperant" occurrences across all .ts, .tsx, .json, .html, .css, and .md files returns zero results.

---

_Verified: 2026-04-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
