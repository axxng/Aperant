---
plan: 03-06
phase: 03-github-oauth-login
status: checkpoint
completed_tasks: 1
total_tasks: 2
checkpoint_type: human-verify
---

# Plan 03-06: Final Verification — GitHub OAuth Login

## What Was Built (Plans 03-01 through 03-05)

- **Test stubs** (03-01): Nyquist contract established — github.test.ts, callback.test.ts, users.test.ts
- **Foundation** (03-02): DB migration 012 (github_token/github_login columns, drop otp_codes), githubFetch(token, url) signature, upsertOAuthUser with role-preserving ON CONFLICT, OTP files deleted, resend uninstalled
- **OAuth routes** (03-03): GET /api/auth/github (CSRF state cookie + GitHub redirect), GET /api/auth/github/callback (token exchange, upsert, JWT redirect), me.ts exposes githubLogin, githubToken removed from settings
- **Proxy migration** (03-04): All 9 GitHub proxy routes use per-user OAuth token; 403 returned when github_token absent
- **Frontend** (03-05): LoginPage replaced with single "Sign in with GitHub" button; App.tsx picks up ?token= JWT; OTP removed from auth-store; githubToken removed from settings-store and Settings.tsx; both i18n files updated

## Automated Checks — All Pass

- `npm test`: 32/32 tests pass (6 test files)
- OTP files: request-otp.ts, verify-otp.ts, otp.ts, email.ts — all deleted
- resend: removed from package.json
- SameSite=Lax: confirmed in api/auth/github.ts
- ON CONFLICT upsert: confirmed in api/_lib/db/users.ts
- github-sync.ts: unchanged (still uses its own getGitHubToken)

## Pending: Human Smoke Test

Task 2 requires human verification of the end-to-end OAuth flow in browser.
See how-to-verify section in 03-06-PLAN.md.
