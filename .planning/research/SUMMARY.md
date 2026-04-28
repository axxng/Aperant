# Project Research Summary

**Project:** Currents — GitHub Issues Browser + Triage
**Domain:** GitHub API integration, multi-repo triage workflow, backlog task promotion
**Researched:** 2026-04-21
**Confidence:** HIGH

## Executive Summary

This milestone adds a first-class GitHub Issues browser and triage workflow to the Currents web app. The core experience is a cross-repo inbox where teams work through untriaged GitHub issues, assign internal priority, post structured notes back to GitHub as comments, and promote issues into the existing Currents backlog. The recommended build is entirely additive: one new DB table (`issue_triage`), a handful of new API routes following existing patterns, and a new React route pair (`/issues` and `/products/:id/issues`). No new infrastructure, no new backend language, and no replacement of existing patterns is required.

**Stack additions are minimal.** TanStack Query v5 handles client-side caching, pagination, and stale-while-revalidate for the issues list. URL params via the already-present `react-router-dom` v7 `useSearchParams` manage filter state, making triage sessions shareable. The existing `githubFetch`/`githubGraphQL` proxy pattern stays — Octokit adds no value here. Cross-repo aggregation belongs server-side (`/api/issues` with `Promise.allSettled()` fan-out), not in the browser.

**Two critical risks must be addressed in Phase 1:** rate-limit transparency (currently `githubFetch()` passes 403/429 through as generic errors with no header inspection) and comment idempotency (a retry on POST creates a duplicate GitHub comment — requires `github_comment_id` + `comment_status` columns in the initial migration).

---

## Key Findings

### Stack

| Decision | Rationale |
|----------|-----------|
| TanStack Query v5 (`@tanstack/react-query`) | Paginated server state with caching, dedup, stale detection — Zustand cannot do this without significant hand-rolling |
| `useSearchParams` (react-router-dom v7) | URL-synced filter state makes triage sessions shareable; already in `package.json` |
| No Octokit | Adds 50–150 KB cold-start weight; existing `githubFetch()` proxy is sufficient |
| Page-based Load More | GitHub Issues REST API uses integer `page`/`per_page`; `per_page=50`; infinite scroll wrong for deliberate triage work |
| `sort=created&direction=desc` | Creation date is stable; `sort=updated` causes page-sort instability between fetches |
| Defer ETag caching | At 3–20 users with ~20 products, 5000/hour rate limit is unlikely to be hit; revisit if observed in production |

### Features — Table Stakes

- Issue list per repo: title, number, labels, assignee, created date, state filter
- Filter by open/closed state (default entry)
- Filter by label (multi-select) and assignee (single at MVP)
- Keyword search by title via GitHub API `q=` param
- Issue detail panel (slide-over drawer) with rendered Markdown body
- Load More pagination
- Link-out to GitHub from the detail panel
- Loading and empty states; actionable error when token is missing

### Features — Differentiators

- Internal priority (Critical/High/Medium/Low) stored in Currents, not as GitHub labels
- Triaged / untriaged toggle — clear done state per triage session
- Cross-repo unified view — all products in one list; no native GitHub UI solves this
- Notes that post to GitHub as comments — single source of truth on GitHub
- Promote-to-backlog task with live write-back sync
- Keyboard navigation (`j`/`k`) through issues in the triage panel

### Features — Defer

Snooze, bulk triage, duplicate detection (requires AI), comment thread display (high API cost), per-issue label management (sync problems).

### Architecture

One new DB table (`issue_triage`) anchors all triage state. Server-side aggregation in a new `/api/issues` endpoint fans out to each product's repo with `Promise.allSettled()`, attaches triage state from DB, and returns a single sorted array. The triage panel writes to two systems explicitly: triage state to `/api/triage/[owner]/[repo]/[number]`, notes to the existing `/api/github/repos/[owner]/[repo]/issues/[number]/comment` route.

**New DB table (migration 009):**
```sql
CREATE TABLE issue_triage (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,          -- "owner/repo"
  issue_number INTEGER NOT NULL,
  priority TEXT,               -- critical/high/medium/low
  triaged INTEGER NOT NULL DEFAULT 0,
  triaged_by TEXT,
  task_id TEXT REFERENCES tasks(id),
  github_comment_id TEXT,      -- idempotency: set after comment posted
  comment_status TEXT,         -- pending/posted/failed
  issue_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo, issue_number)
);
```

**New API routes:**
| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/triage/[owner]/[repo]/[number]` | GET | Bearer | Fetch triage state for one issue |
| `/api/triage/[owner]/[repo]/[number]` | PUT | Bearer + member | Upsert triage state |
| `/api/issues` | GET | Bearer | Cross-repo aggregated issues with triage state |

**Existing routes reused unchanged:**
- `POST /api/tasks` — promote-to-task creation
- `POST /api/github/repos/[owner]/[repo]/issues/[number]/comment` — note posting
- `GET /api/github/repos/[owner]/[repo]/issues` — extend only to add `labels` + `assignee` params

### Critical Pitfalls

| # | Pitfall | Phase | Mitigation |
|---|---------|-------|-----------|
| 1 | `githubFetch()` has no rate-limit awareness — 403/429 pass through as generic errors | Phase 1 | Inspect `x-ratelimit-remaining`; throw typed `GitHubRateLimitError`; surface actionable UI message |
| 2 | Comment posting (ISSUES-04) is non-idempotent — retry creates duplicate GitHub comment | Phase 1 (schema) | `github_comment_id` + `comment_status` columns in initial migration; check before posting |
| 3 | Cross-repo N+1 amplifies rate-limit budget | Phase 3 | Server-side fan-out in batches of 3–5 with `Promise.allSettled()`; return partial failures gracefully |
| 4 | Page-sort instability when `sort=updated` | Phase 2 | Use `sort=created&direction=desc` as triage inbox default |
| 5 | `syncTaskToGitHub()` does bare PATCH — silently overwrites concurrent GitHub edits | Phase 5 | Pre-fetch `updated_at` before PATCH; surface abandoned write-back as UI warning badge |

---

## Suggested Build Order

### Phase 1 — Foundation (prerequisite for all)
DB migration with all required columns (including `github_comment_id`, `comment_status`); `api/_lib/db/triage.ts`; GET/PUT triage API routes; rate-limit-aware `githubFetch()` with typed errors; extend issues proxy with `labels`/`assignee` params; i18n keys.
- **Must ship before any new GitHub calls land**

### Phase 2 — Single-repo issues browser (ISSUES-01)
`QueryClientProvider`; `useInfiniteQuery` hook for single-repo issues; `IssueCard`, `IssueFilterBar` with URL-synced filters; `/products/:id/issues` route + sidebar link; Load More pagination; issue detail panel with Markdown rendering; triage state read from Phase 1 routes.
- **Validates TanStack Query + URL params at small scale before cross-repo complexity**

### Phase 3 — Cross-repo unified view (ISSUES-02)
`GET /api/issues` server-side batched fan-out; `/issues` top-level route + sidebar "Issues" nav item; product color badges; partial-failure repo-level error banners.
- **Needs design sign-off on batch size and partial-failure UX before building**

### Phase 4 — Triage actions + notes (ISSUES-03 + ISSUES-04)
`IssueTriagePanel` with priority picker, triaged toggle, notes field; keyboard navigation; idempotent comment flow with `pending_comment` → `posted`/`failed` status; closed-issue warning.
- **Write path; builds on stable schema (Phase 1) and stable list (Phase 2)**

### Phase 5 — Promote to backlog (ISSUES-05)
Promote button in triage panel and quick-promote from issue row; two-call sequence (`POST /api/tasks` → `PUT /api/triage` with `task_id`); "Promoted" badge linking to Kanban task; idempotency guard; write-back conflict detection.
- **Reuses existing task creation endpoint unchanged; write-back activates automatically**

---

## Open Questions

- **Default sort order:** `sort=created` for pagination stability vs. `sort=updated` for newest activity. Validate with team before Phase 2 ships.
- **Cross-repo batch size:** Research recommends 3–5 repos per batch; tune based on observed secondary-limit behaviour after Phase 3 ships.
- **Stale issue refresh:** Use fixed-time threshold (e.g., 10 minutes) or cron last-run timestamp. Decide during Phase 4 planning.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TanStack Query v5 API, `useSearchParams` confirmed against official docs |
| Features | HIGH | Table stakes validated against GitHub's native UI; differentiators from ZenHub/Linear/Kubernetes triage patterns |
| Architecture | HIGH | Based on direct codebase inspection; all new routes follow verified existing patterns |
| Pitfalls | HIGH | Rate-limit behaviour confirmed in GitHub docs; code gaps confirmed by direct inspection |

---
*Research completed: 2026-04-21 | Ready for roadmap: yes*
