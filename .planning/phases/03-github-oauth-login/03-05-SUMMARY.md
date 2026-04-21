---
phase: 03-github-oauth-login
plan: "05"
subsystem: frontend
tags: [oauth, login, auth, i18n, settings]
dependency_graph:
  requires: [03-03, 03-04]
  provides: [oauth-login-ui, oauth-token-pickup]
  affects: [LoginPage, App, auth-store, settings-store, Settings]
tech_stack:
  added: []
  patterns: [zustand-store-cleanup, oauth-token-pickup, i18n-key-replacement]
key_files:
  created: []
  modified:
    - apps/web/src/client/components/LoginPage.tsx
    - apps/web/src/client/stores/auth-store.ts
    - apps/web/src/client/stores/settings-store.ts
    - apps/web/src/shared/i18n/locales/en/auth.json
    - apps/web/src/shared/i18n/locales/fr/auth.json
    - apps/web/src/client/App.tsx
    - apps/web/src/client/components/Settings.tsx
decisions:
  - "LoginPage rewritten as single GitHub OAuth button anchor to /api/auth/github — no OTP form"
  - "App.tsx token pickup uses fetch('/api/auth/me') to validate JWT before storing, then cleans URL via history.replaceState"
  - "Eye/EyeOff icon imports removed from Settings.tsx after githubToken input section deleted"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
requirements: [AUTH-08, AUTH-09]
---

# Phase 03 Plan 05: Frontend OAuth UI — GitHub OAuth Login Summary

One-liner: Replaced OTP LoginPage with single GitHub OAuth button, wired JWT pickup in App.tsx, and scrubbed all OTP/githubToken references from stores, Settings, and i18n files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace LoginPage, auth-store, settings-store, i18n | 4155f64c | LoginPage.tsx, auth-store.ts, settings-store.ts, en/auth.json, fr/auth.json |
| 2 | Update App.tsx OAuth token pickup, remove GitHub token from Settings | 19d81716 | App.tsx, Settings.tsx |

## What Was Built

- **LoginPage.tsx** — Full rewrite: single `<Button asChild>` containing `<a href="/api/auth/github">` with `t('auth:signInWithGitHub')`. All OTP state, handlers, and Input/Label/useAuthStore imports removed.

- **auth-store.ts** — `requestOtp` and `verifyOtp` functions removed from interface and implementation. `initiateGitHubOAuth` added (redirects to `/api/auth/github`). `githubLogin?: string | null` added to `User` interface.

- **settings-store.ts** — `githubToken` field, `setGithubToken` action, and `loadFromApi` entry all removed. No other fields affected.

- **en/auth.json + fr/auth.json** — OTP keys (`sendCode`, `verifyCode`, `codePlaceholder`, `codeSent`, `codeError`, `sendError`, `rateLimited`, `backToEmail`, `email`, `emailPlaceholder`) replaced with `signInWithGitHub`, `oauthError`, and updated `welcomeDescription`.

- **App.tsx** — Mount `useEffect` extended: checks `?token=` query param first, fetches `/api/auth/me` to validate JWT, stores via `setAuth`, cleans URL with `window.history.replaceState({}, '', '/')`, then falls through to existing `checkSession` path.

- **Settings.tsx** — GitHub token `<SettingsSection>` block removed (input, show/hide toggle, description). `showGithubToken` state removed. `editedFields.has('githubToken')` save-handler condition removed. Unused `Eye`, `EyeOff` imports removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing cleanup] Removed unused Eye/EyeOff imports from Settings.tsx**
- **Found during:** Task 2
- **Issue:** After removing the GitHub token input block, `Eye` and `EyeOff` from lucide-react were unused imports that would cause lint warnings
- **Fix:** Removed `Eye` and `EyeOff` from the lucide-react import line
- **Files modified:** apps/web/src/client/components/Settings.tsx
- **Commit:** 19d81716

## Known Stubs

None — all OAuth keys are wired to the actual `/api/auth/github` endpoint.

## Threat Flags

No new security surface beyond what is documented in the plan threat model (T-03-13, T-03-14).

## Self-Check: PASSED

- LoginPage.tsx — no useState/useRef/Input/Label/useAuthStore: PASS
- auth-store.ts requestOtp/verifyOtp count: 0 — PASS
- auth-store.ts initiateGitHubOAuth+githubLogin count: 3 — PASS
- settings-store.ts githubToken count: 0 — PASS
- en/auth.json signInWithGitHub: 1 — PASS
- fr/auth.json signInWithGitHub: 1 — PASS
- App.tsx params.get/replaceState/api/auth/me count: 3 — PASS
- Settings.tsx githubToken count: 0 — PASS
- npm test: 32/32 passed — PASS
- Commits 4155f64c and 19d81716 exist: PASS
