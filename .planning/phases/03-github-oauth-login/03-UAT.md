---
status: complete
phase: 03-github-oauth-login
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md]
started: 2026-04-21T00:00:00.000Z
updated: 2026-04-21T00:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Clear ephemeral state (temp DBs, caches). Start the app from scratch with `cd apps/web && npm run dev`. Server boots without errors, migration 012 runs (github_token/github_login columns added, otp_codes dropped), and the app loads at http://localhost:5173.
result: pass

### 2. Login page shows only GitHub OAuth button
expected: Open http://localhost:5173 while logged out. The login page shows ONLY a "Sign in with GitHub" button — no email input field, no OTP form, no "Send code" button anywhere on the page.
result: pass

### 3. Clicking "Sign in with GitHub" redirects to GitHub
expected: Click the "Sign in with GitHub" button. The browser redirects to `https://github.com/login/oauth/authorize` (GitHub's OAuth authorization page). You should see GitHub's UI asking you to authorize the app.
result: pass

### 4. OAuth callback completes login
expected: After authorizing on GitHub, you are redirected back to the app. The URL briefly shows `/?token=<jwt>` then immediately cleans to `/`. You are now logged in and see the main app view (Kanban board or dashboard) — no manual token entry required.
result: pass

### 5. Settings has no GitHub token field
expected: Navigate to Settings (while logged in). There is no "GitHub token" input field anywhere in Settings. Only the GitLab token or other non-GitHub-PAT fields remain for third-party integrations.
result: pass

### 6. GitHub issues load using OAuth token
expected: Navigate to a product's issues list. Issues load successfully without any PAT configuration. The app uses your logged-in GitHub OAuth token behind the scenes — no "GitHub account not connected" error and no need to set a PAT.
result: skipped
reason: OAuth token doesn't have access to the expected repos in this environment

### 7. oauth_state cookie cleared after login
expected: Open browser DevTools → Application → Cookies → http://localhost:5173. After successfully completing the OAuth flow and logging in, the `oauth_state` cookie is NOT present (the callback cleared it).
result: pass

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1
skipped: 0
blocked: 0

## Gaps

[none yet]
