---
phase: 03-github-oauth-login
plan: 02
subsystem: auth/db
tags: [migration, github-oauth, otp-removal, db-schema]
dependency_graph:
  requires: []
  provides:
    - migration-012-github-oauth
    - githubFetch-token-first-signature
    - upsertOAuthUser
  affects:
    - apps/web/api/_lib/db/client.ts
    - apps/web/api/_lib/db/users.ts
    - apps/web/api/_lib/github.ts
tech_stack:
  added: []
  patterns:
    - ON CONFLICT(email) DO UPDATE with role exclusion for OAuth upsert
key_files:
  created: []
  modified:
    - apps/web/api/_lib/db/client.ts
    - apps/web/api/_lib/db/users.ts
    - apps/web/api/_lib/github.ts
    - apps/web/api/_lib/github.test.ts
  deleted:
    - apps/web/api/auth/request-otp.ts
    - apps/web/api/auth/verify-otp.ts
    - apps/web/api/_lib/auth/otp.ts
    - apps/web/api/_lib/auth/email.ts
decisions:
  - "role excluded from ON CONFLICT DO UPDATE SET — preserves admin role for re-authenticating users (T-03-02)"
  - "bootstrapAdmin removal: first-user-is-admin check in OAuth callback replaces env-var seeding (T-03-04)"
  - "Pre-existing proxy route callers of old githubFetch/githubGraphQL signatures deferred to Wave 2 — they will be migrated in plan 03-03+"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-21"
  tasks: 2
  files_changed: 9
---

# Phase 03 Plan 02: Foundation — DB Migration, Signature Updates, OTP Removal Summary

**One-liner:** Migration 012 adds `github_token`/`github_login` columns and drops `otp_codes`, `githubFetch(token, url)` signature change, `upsertOAuthUser()` with role-preserving ON CONFLICT upsert, and full OTP infrastructure removal.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | DB migration 012 + bootstrapAdmin removal + OTP files deleted + resend uninstalled | c35a6eb6 | client.ts, 4 deleted files, package.json |
| 2 (RED) | Update githubFetch tests to new signature | fe576af4 | github.test.ts |
| 2 (GREEN) | Update githubFetch/githubGraphQL signatures; add upsertOAuthUser | 7bf4a6d2 | github.ts, users.ts |

## Acceptance Criteria Verified

- `apps/web/api/_lib/db/client.ts` contains `012_github_oauth` — PASS
- `apps/web/api/_lib/db/client.ts` contains `DROP TABLE IF EXISTS otp_codes` — PASS
- `apps/web/api/_lib/db/client.ts` contains `ALTER TABLE users ADD COLUMN github_token TEXT` — PASS
- `apps/web/api/_lib/db/client.ts` contains `ALTER TABLE users ADD COLUMN github_login TEXT` — PASS
- `grep -c "bootstrapAdmin" apps/web/api/_lib/db/client.ts` returns `0` — PASS
- `grep -c "uuid" apps/web/api/_lib/db/client.ts` returns `0` — PASS
- OTP files (`request-otp.ts`, `verify-otp.ts`, `otp.ts`, `email.ts`) do NOT exist — PASS
- `resend` removed from `apps/web/package.json` — PASS
- `githubFetch(token: string, url: string` signature present — PASS
- `githubGraphQL(token: string, query: string` signature present — PASS
- `getGitHubToken` and `resolveConfig` import deleted from `github.ts` — PASS
- `upsertOAuthUser` added to `users.ts` — PASS
- `github_token: string | null` and `github_login: string | null` in `UserRow` — PASS
- `ON CONFLICT(email) DO UPDATE SET` present without `role` in SET clause — PASS

## TDD Gate Compliance

- RED commit: `fe576af4` — test(03-02): update githubFetch tests to expect token as first parameter
- GREEN commit: `7bf4a6d2` — feat(03-02): update githubFetch/githubGraphQL signatures; add upsertOAuthUser to users.ts

## Deviations from Plan

### Deferred Items (Out of Scope)

**1. Pre-existing proxy route callers with old githubFetch/githubGraphQL signatures**
- **Found during:** Task 2 verification
- **Files affected:** `github-writeback.ts`, `issues.ts`, `labels.ts`, `branches.ts`, `pulls/index.ts`, `pulls/[number]/index.ts`, `pulls/[number]/files.ts`, `projects/[owner]/[number]/items.ts`, `projects/[owner]/[number]/index.ts`, `issues/[number]/comment.ts`
- **Disposition:** Intentional — Wave 2 plans (03-03+) explicitly migrate these proxy route callers to the new token-first signature. These callers receive token via `requireAuth` middleware in OAuth flow.
- **Logged to:** deferred-items.md (below)

### Pre-existing Test Failures (Not Introduced by This Plan)

Two `TODO`-marked tests in `issues.test.ts` fail both before and after this plan's changes:
- `TODO: passes labels param to GitHub API URL`
- `TODO: passes assignee param to GitHub API URL`

These are placeholder tests for Phase 2 work and are out of scope.

## Known Stubs

None — no stub values introduced by this plan.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Migration 012 runs via existing migration guard (no user input). `github_token` stored in DB is accessible only via `TURSO_AUTH_TOKEN`-authenticated Turso connection (T-03-03 accepted).

## Self-Check: PASSED

- `apps/web/api/_lib/db/client.ts` — FOUND
- `apps/web/api/_lib/db/users.ts` — FOUND
- `apps/web/api/_lib/github.ts` — FOUND
- Commit `c35a6eb6` — FOUND
- Commit `fe576af4` — FOUND
- Commit `7bf4a6d2` — FOUND
- OTP files confirmed deleted
