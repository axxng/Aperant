# Currents

## What This Is

Currents is a web-based multi-product backlog management platform for small teams (3–20 people) managing work across multiple GitHub repositories. Teams use it to browse and triage GitHub issues across all their connected repos, prioritize work, and maintain a shared Kanban backlog — without switching back to GitHub's native issue view.

## Core Value

A team can run a full triage session — browse issues from all connected repos, assign priority, leave notes, and promote the right ones to the backlog — entirely inside Currents.

## Requirements

### Validated

- ✓ Multi-product Kanban board with consolidated and per-product views — existing
- ✓ Task CRUD with drag-and-drop, priority, category, inline editing — existing
- ✓ GitHub write-back sync — task edits pushed back to linked GitHub issues (title, body, state, labels, assignees, project board column) — existing
- ✓ Pending write-back retry via cron job with UI feedback (spinner, warning toast) — existing
- ✓ Email OTP authentication (Resend) with role-based access (admin, member, viewer) and admin bootstrap via env var — existing
- ✓ Polling-based real-time sync with toast notifications (3s interval, multi-tab/multi-user) — existing
- ✓ Settings page: themes (7), dark/light/system, language (EN/FR), GitHub token, sync interval — existing
- ✓ Admin user management panel — existing
- ✓ Vercel serverless + Turso (LibSQL) infrastructure — existing
- ✓ GitHub API proxy (repos, issues, PRs, projects via REST and GraphQL) — existing

### Active

- [ ] **ISSUES-01**: User can browse open and closed GitHub issues for each connected repo with search, label, and assignee filters
- [ ] **ISSUES-02**: User can view all GitHub issues from every connected product's repo in a single unified cross-repo list
- [ ] **ISSUES-03**: User can triage an issue — assign internal priority, mark as triaged — without modifying the GitHub issue
- [ ] **ISSUES-04**: User can leave an internal note on an issue that is posted as a comment on the GitHub issue
- [ ] **ISSUES-05**: User can promote a GitHub issue to a backlog task with a live write-back link (task edits sync back to the GitHub issue via the existing write-back mechanism)

### Out of Scope

- AI issue investigation — deferred; no AI features in this milestone
- GitHub PR review — deferred to a future milestone
- Insights AI chat — deferred to a future milestone
- Roadmap & strategic planning — deferred to a future milestone
- Ideation AI auto-discovery — deferred to a future milestone
- Changelog generation — deferred to a future milestone
- GitLab integration — deferred to a future milestone
- Multiple repos per product — keep existing one-repo-per-product model for now
- Org-level GitHub connection — per-product token model is sufficient for team size

## Context

The web app (`apps/web/`) is a React 19 SPA deployed on Vercel with serverless functions backed by Turso. It was extracted from a larger Electron desktop app (Auto Claude / Aperant) — the desktop app code in `apps/desktop/` is not part of this project's scope.

The existing GitHub API proxy (`api/github/`) already covers issues, PRs, branches, and GitHub Projects. The write-back sync module (`api/_lib/sync/github-writeback.ts`) provides the pattern for syncing task changes back to GitHub. These are the primary building blocks for the issues browser and triage features.

**Current triage gap:** Users must leave Currents and go to github.com to browse and prioritize new issues. The backlog only contains issues that have been manually created as tasks or pulled in via GitHub Project sync.

## Constraints

- **Tech stack**: Vercel serverless + Turso only — no new infra; new API routes go in `api/` following existing patterns
- **Auth**: All new routes must use `requireAuth` / `requireRole` middleware from `api/_lib/auth/middleware.ts`
- **i18n**: All new UI text uses `react-i18next`; add keys to both `en/*.json` and `fr/*.json`
- **Write-back pattern**: Issue-to-task promotion reuses `api/_lib/sync/github-writeback.ts` — don't duplicate sync logic
- **No AI**: This milestone has no AI features; don't add Vercel AI SDK dependencies to new routes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Triage notes posted as GitHub comments | Team wants a single source of truth on GitHub; no split-brain between app DB and GitHub | — Pending |
| Live write-back link on promoted tasks | Consistent with existing write-back pattern; team wants GitHub issues and backlog tasks to stay in sync | — Pending |
| Per-product repo model (one repo per product) | Existing model is sufficient; adding multi-repo per product would require schema changes not needed now | — Pending |
| No AI features in this milestone | Focus on replacing GitHub's issue view first; AI investigation can layer on top once the browse/triage flow is solid | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after Phase 1 completion — Foundation*
