# Phase 7: GitHub OAuth Login - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 07-github-oauth-login
**Areas discussed:** Auth model, Token ownership, Admin role, Repo access, OAuth App type, Token storage, Email OTP removal, OAuth scopes, Roadmap ordering, Login UI, New user role assignment

---

## Auth Model

| Option | Description | Selected |
|--------|-------------|----------|
| Connect step after OTP login | GitHub OAuth added as a connect step; email OTP stays as primary login | |
| GitHub OAuth as primary login | Replace email OTP entirely with GitHub OAuth | ✓ |
| Both options available | Email OTP and GitHub OAuth both available | |

**User's choice:** GitHub OAuth as primary login — remove email OTP entirely.

---

## Token Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| One shared team token | Admin connects GitHub once; all users share that token | |
| Per-user GitHub tokens | Each user connects their own GitHub account; individual tokens used per request | ✓ |

**User's choice:** Per-user GitHub tokens.

---

## Admin Role Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| First GitHub user to log in is admin | First OAuth user = admin; subsequent = member | ✓ |
| GitHub org membership | Admin = GitHub org owners (requires org read scope) | |
| Manual env var bootstrap | ADMIN_EMAIL/GITHUB_LOGIN env var determines admin | |

**User's choice:** First GitHub user to log in is admin.

---

## Repo Access Model

| Option | Description | Selected |
|--------|-------------|----------|
| Admin configures products, users' tokens provide access | Products/repos still configured by admin; each user's token used for API calls | ✓ |
| Repos auto-discovered from OAuth scopes | After OAuth, repos are auto-listed and suggested as products | |

**User's choice:** Admin configures products; users' tokens provide GitHub API access.

---

## OAuth App Type

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub OAuth App | Standard OAuth 2.0, non-expiring tokens, GITHUB_CLIENT_ID + CLIENT_SECRET | ✓ |
| GitHub App (installation-based) | Short-lived tokens, more powerful, more setup | |

**User's choice:** GitHub OAuth App.

---

## Token Storage

| Option | Description | Selected |
|--------|-------------|----------|
| New github_token column on users table | Add columns to existing users table via migration | ✓ |
| New oauth_tokens table | Separate table for multi-provider support | |

**User's choice:** New columns on existing users table.

---

## Email OTP Removal

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it entirely | OTP code, Resend dependency, and OTP UI deleted | ✓ |
| Keep as fallback for admins | Email OTP stays as emergency admin backdoor | |

**User's choice:** Remove email OTP entirely.

---

## OAuth Scopes

| Option | Description | Selected |
|--------|-------------|----------|
| repo (full private repo access) | Read/write on all accessible repos, covers all current API usage | ✓ |
| repo + read:org | Same plus org membership read | |
| public_repo only | Public repos only; blocks private repo access | |

**User's choice:** `repo` scope.

---

## Roadmap Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Move to Phase 3 (after Cross-Repo view) | GitHub OAuth ships before triage/notes/promote phases | ✓ |
| Keep after Phase 6 (current) | All features ship with PAT first, OAuth layered on at the end | |
| Make it Phase 2.5 (insert now) | GitHub OAuth is the very next phase | |

**User's choice:** Move to after Phase 3 (becomes new Phase 4).
**Notes:** User cited UAT readiness as the reason to move it earlier.

---

## Login UI

| Option | Description | Selected |
|--------|-------------|----------|
| Single 'Sign in with GitHub' button | Replace OTP form with GitHub OAuth button; no fields | ✓ |
| Keep login page structure, swap form | Same layout, OTP form replaced with GitHub button | |

**User's choice:** Single "Sign in with GitHub" button.

---

## New User Role

| Option | Description | Selected |
|--------|-------------|----------|
| Member by default, first user is admin | Auto-promote first user, others are members | |
| Member, admin manually promotes | Members are members; admin manually promotes via user panel | ✓ |

**User's choice:** Member by default; admin manually promotes to admin via user management panel.

---

## Claude's Discretion

- Encryption of `github_token` at rest
- OAuth state/CSRF implementation details
- Session JWT structure (reuse existing fields, add `githubLogin`)

## Deferred Ideas

- GitHub App installation tokens
- Org membership-based role assignment
- Multiple OAuth providers
- Token refresh/revocation webhooks
