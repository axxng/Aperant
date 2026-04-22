# Roadmap: Currents — GitHub Issues Browser + Triage

## Overview

This milestone adds a first-class GitHub Issues browser and triage workflow to Currents. The build is entirely additive: one new DB table, new API routes following existing patterns, and new React routes. The journey moves from infrastructure safety (rate-limit handling and schema migration) through a single-repo issues browser, cross-repo unified view, triage actions, notes posted as GitHub comments, and finally issue promotion into the Kanban backlog.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Rate-limit safety, DB migration, and triage API routes — prerequisites for all GitHub calls (completed 2026-04-21)
- [x] **Phase 2: Single-Repo Issues Browser** - Per-product issues list with filters, search, pagination, and detail panel (completed 2026-04-21)
- [x] **Phase 3: GitHub OAuth Login** - Replace email OTP with GitHub OAuth; per-user tokens; remove PAT setting (completed 2026-04-21)
- [ ] **Phase 4: Cross-Repo Unified View** - Server-side fan-out aggregating all repos into one list with partial-failure handling
- [x] **Phase 5: Triage Actions** - Internal priority, triaged toggle, keyboard navigation, and closed-issue warning (completed 2026-04-22)
- [ ] **Phase 6: Notes** - Idempotent note posting as GitHub comments with success/failure feedback
- [ ] **Phase 7: Promote to Backlog** - One-action promotion to Kanban task with live write-back and duplicate guard

## Phase Details

### Phase 1: Foundation
**Goal**: Rate-limit errors surface actionable messages and the triage DB schema is in place before any new GitHub calls land
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. When GitHub returns 429 or a rate-limit 403, users see a message stating when they can retry — not a generic error
  2. The `issue_triage` table exists in production with all required columns including `github_comment_id` and `comment_status`
  3. GET and PUT `/api/triage/[owner]/[repo]/[number]` routes respond correctly under auth and return triage state
  4. The existing `/api/github/repos/[owner]/[repo]/issues` proxy accepts `labels` and `assignee` query params without breaking existing callers
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Vitest config + GitHubRateLimitError class + githubFetch() rate-limit detection + unit tests
- [x] 01-02-PLAN.md — 011_issue_triage DB migration + triage.ts DB helpers (getTriageRecord, upsertTriageRecord) + unit tests
- [x] 01-03-PLAN.md — Triage API routes (GET + PUT) + issues proxy filter extension (labels, assignee) + rate-limit catch

### Phase 2: Single-Repo Issues Browser
**Goal**: Users can browse, filter, search, and inspect GitHub issues for any connected product repo without leaving Currents
**Depends on**: Phase 1
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-05, BROWSE-06, BROWSE-07, BROWSE-08
**Success Criteria** (what must be TRUE):
  1. User can navigate to a product's issues list and see open issues by default, with the option to switch to closed issues
  2. User can filter the list by one or more labels simultaneously and by a single assignee, with filter state preserved in the URL
  3. User can type a keyword into a search field and see matching issues by title
  4. User can click an issue to open a detail panel showing rendered Markdown body, labels, assignee, and created date
  5. User can click "Load More" to fetch the next page of 50 issues, and can navigate from the detail panel directly to the issue on github.com
**Plans**: 7 plans
Plans:
- [x] 02-01-PLAN.md — Deps install (@tanstack/react-query, react-markdown, remark-gfm, @tailwindcss/typography) + typography plugin + test stubs
- [x] 02-02-PLAN.md — labels.ts API route (authenticated, validated, rate-limit-aware)
- [x] 02-03-PLAN.md — App.tsx wiring (QueryClientProvider + IssuesView route) + en/fr issues.json i18n files
- [x] 02-04-PLAN.md — useIssuesFilters hook + IssueListRow + IssueSkeletonRow components
- [x] 02-05-PLAN.md — IssuesFilterBar component (search + label multi-select + assignee + state toggle)
- [x] 02-06-PLAN.md — IssueDetailPanel component (slide-in, react-markdown body, View on GitHub)
- [x] 02-07-PLAN.md — IssuesView assembly (useInfiniteQuery, full wiring, human verification checkpoint)

### Phase 3: GitHub OAuth Login
**Goal**: Replace email OTP authentication with GitHub OAuth; each user's GitHub token is stored per-user and used for all GitHub API calls; the admin-set PAT and Resend email dependency are removed
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-13
**Success Criteria** (what must be TRUE):
  1. Users can log in via "Sign in with GitHub" button — no email form, no OTP
  2. Each user's GitHub OAuth token is stored in the DB and used for GitHub API calls scoped to that user
  3. The first user to log in is assigned admin; subsequent users are members by default; admin can promote members manually
  4. Email OTP routes, Resend dependency, and the shared `githubToken` settings key are removed
  5. All existing GitHub API proxy routes use the requesting user's token instead of the shared PAT
**Plans**: 6 plans
**Note**: INSERTED — moved from Phase 7 for UAT readiness
Plans:
- [x] 03-01-PLAN.md — Wave 0 test stubs: github.test.ts, callback.test.ts, users.test.ts + update issues/labels test mocks
- [x] 03-02-PLAN.md — DB migration 012 (github_token, github_login, drop otp_codes) + githubFetch/githubGraphQL signature + upsertOAuthUser + OTP files deleted + resend uninstalled
- [x] 03-03-PLAN.md — OAuth initiate route (api/auth/github.ts) + OAuth callback route (api/auth/github/callback.ts) + settings cleanup + me.ts update
- [x] 03-04-PLAN.md — Migrate all 9 GitHub proxy routes to per-user token resolution
- [x] 03-05-PLAN.md — Frontend: LoginPage replacement + App.tsx token pickup + auth-store + settings-store + Settings.tsx + i18n files
- [x] 03-06-PLAN.md — Full test suite + human verification smoke test

### Phase 4: Cross-Repo Unified View
**Goal**: Users can see all GitHub issues from every connected product repo in a single list, with clear origin labelling and graceful partial failure
**Depends on**: Phase 3
**Requirements**: CROSS-01, CROSS-02, CROSS-03
**Success Criteria** (what must be TRUE):
  1. User can navigate to a top-level "Issues" view and see issues from all connected repos aggregated in one list
  2. Each issue card in the unified list displays a colour badge identifying which product repo it belongs to
  3. When one repo's GitHub request fails, the user sees a per-repo error indicator for that repo while the other repos' issues still load and display
**Plans**: 4 plans
**UI hint**: yes
Plans:
- [x] 04-01-PLAN.md — Wave 0: extend Vitest for frontend (jsdom) + IssueListRow.test.tsx stubs (CROSS-02) + AllIssuesView.test.tsx stubs (CROSS-01, CROSS-03)
- [x] 04-02-PLAN.md — IssueListRow productBadge prop extension + useAllIssuesFilters hook + i18n keys (en/fr issues.json + navigation.json)
- [x] 04-03-PLAN.md — AllIssuesView component (useQueries fan-out, merge+sort, error banners, product badges)
- [x] 04-04-PLAN.md — App.tsx /issues route + Sidebar All Issues NavLink + human verification checkpoint

### Phase 04.1: Engineering Principles Refactor: parse-dont-validate, functional core imperative shell, FSM illegal state, red-green TDD (INSERTED)

**Goal:** Refactor the existing codebase to enforce four core engineering principles — parse-don't-validate, functional core/imperative shell, FSM for illegal state elimination, and red-green TDD — then codify these as standing standards in root CLAUDE.md so all future phases inherit them automatically
**Requirements**: TBD (cross-cutting refactor — covers decisions D-01 through D-09)
**Depends on:** Phase 4
**Plans:** 5 plans

Plans:
- [x] 04.1-01-PLAN.md — Wave 0 TDD stubs: tasks.test.ts (9 failing stubs for rowToTask + buildSyncState) + products.test.ts (2 failing stubs for rowToProduct)
- [x] 04.1-02-PLAN.md — Type foundation: Task discriminated union + GithubSyncState + TriageState + Zod DB row schemas + rowToTask/rowToTriage/rowToProduct Zod parse + cascade TypeScript fixes
- [x] 04.1-03-PLAN.md — GitHub API boundary: gitHubApiIssueSchema + gitHubApiPRSchema + oauthTokenResponseSchema + gitHubUserSchema in validation.ts; mapGitHubPR/mapGitHubIssue Zod parse; extend github.test.ts + triage.test.ts
- [x] 04.1-04-PLAN.md — Handler 4-step shape sweep: callback.ts pure function extraction + 26 handlers reshaped + callback.test.ts pure function tests
- [x] 04.1-05-PLAN.md — Engineering Principles codification in root CLAUDE.md

### Phase 04.2: fake data and mocked services for dev env (INSERTED)

**Goal:** Establish a self-contained local development environment for apps/web/ — developers can run the full app without real Turso credentials, a real GitHub OAuth app, or any external service. Codify mocked services as engineering principle 5 in root CLAUDE.md.
**Requirements**: TBD (cross-cutting dev tooling)
**Depends on:** Phase 04.1
**Plans:** 5/5 plans complete

Plans:
- [x] 04.2-01-PLAN.md — Wave 0: test stubs (client.test.ts for MOCK-01/02, seed.test.ts for MOCK-04, github-fixtures.test.ts for MOCK-05) + vite.config.ts scripts test project
- [x] 04.2-02-PLAN.md — Wave 1: MOCK_SERVICES gate in client.ts getClient() — file:dev.db vs Turso
- [x] 04.2-03-PLAN.md — Wave 1: scripts/mocks/github-fixtures.ts (fixture builders + OAuth bypass) + dev-server.ts mock middleware injection
- [x] 04.2-04-PLAN.md — Wave 1: @faker-js/faker install + scripts/seed.ts deterministic seeder (faker.seed(12345), all 8 Kanban statuses)
- [x] 04.2-05-PLAN.md — Wave 2: vite.config.ts define block + DevModeBanner component + App.tsx mount + .env.example docs + CLAUDE.md principle 5

### Phase 5: Triage Actions
**Goal**: Users can assign internal priority and mark issues as triaged directly inside Currents, with keyboard shortcuts and safety warnings — without touching the GitHub issue
**Depends on**: Phase 3
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, TRIAGE-06
**Success Criteria** (what must be TRUE):
  1. User can toggle an issue as triaged and assign it a priority (Critical / High / Medium / Low) from the detail panel; both actions are stored only in Currents
  2. Triage state and priority survive browser refresh and are immediately visible to all team members without a page reload
  3. Issues that have been triaged display a visual badge on their card in the issue list
  4. User can move through issues in the triage panel using `j` (next) and `k` (previous) keyboard shortcuts
  5. When the user attempts to triage or act on a closed GitHub issue, a warning is shown before the action proceeds
**Plans**: 6 plans
Plans:
- [x] 05-01-PLAN.md — Wave 0 TDD stubs: IssueDetailPanel.test.tsx (TRIAGE-01, 02, 03, 06) + IssuesView.test.tsx (TRIAGE-05) + extend IssueListRow.test.tsx (TRIAGE-04) (completed 2026-04-22)
- [x] 05-02-PLAN.md — Wave 1a: IssueListRow TriageBadgeSlot (triageState prop + checkmark + priority pill) + en/fr triage i18n keys (completed 2026-04-22)
- [x] 05-03-PLAN.md — Wave 1b: IssueDetailPanel TriageSection (useQuery lazy fetch + useMutation optimistic + ClosedIssueWarning + TriagedToggle + PrioritySelector) (completed 2026-04-22)
- [x] 05-04-PLAN.md — Wave 2: j/k keyboard nav in IssuesView + AllIssuesView + triageState cache passthrough + human verification (completed 2026-04-22)
- [x] 05-05-PLAN.md — UAT gap closure: X close button, Escape handler, j/k direction fix, mock state filter, stale closure fix (completed 2026-04-22)
- [x] 05-06-PLAN.md — GAP-1 fix: batch triage pre-fetch (getTriageRecordsBatch + batch API endpoint + useEffect in IssuesView + AllIssuesView) (completed 2026-04-22)

### Phase 6: Notes
**Goal**: Users can write and post an internal note on any issue that is added as a comment on the GitHub issue, with no risk of duplicates on retry
**Depends on**: Phase 1, Phase 5
**Requirements**: NOTES-01, NOTES-02, NOTES-03
**Success Criteria** (what must be TRUE):
  1. User can write a note in the detail panel and post it; the note appears as a comment on the linked GitHub issue
  2. If the user retries a failed note post, only one GitHub comment is created — the `github_comment_id` idempotency guard prevents duplicates
  3. After posting, the user sees a clear success confirmation or, on failure, an actionable error message
**Plans**: TBD
**UI hint**: yes

### Phase 7: Promote to Backlog
**Goal**: Users can promote a GitHub issue to a Currents backlog task in one action, with the task staying live-synced to the issue and all promotion safeguards in place
**Depends on**: Phase 5, Phase 6
**Requirements**: PROMOTE-01, PROMOTE-02, PROMOTE-03, PROMOTE-04, PROMOTE-05
**Success Criteria** (what must be TRUE):
  1. User can promote a GitHub issue to a Currents backlog task from the triage panel in a single action
  2. Edits to the promoted task in Currents write back to the GitHub issue via the existing write-back mechanism automatically
  3. An already-promoted issue shows a "View in Backlog" badge linking to the Kanban task instead of the promote button
  4. When promoting, the issue's internal triage priority pre-populates the task priority field
  5. Attempting to promote the same GitHub issue a second time is blocked with a clear message — no duplicate tasks are created
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-04-21 |
| 2. Single-Repo Issues Browser | 7/7 | Complete    | 2026-04-21 |
| 3. GitHub OAuth Login | 6/6 | Complete    | 2026-04-21 |
| 4. Cross-Repo Unified View | 0/4 | Not started | - |
| 04.1. Engineering Principles Refactor | 5/5 | Complete | 2026-04-22 |
| 04.2. Fake Data and Mocked Services | 5/5 | Complete    | 2026-04-22 |
| 5. Triage Actions | 6/6 | Complete | 2026-04-22 |
| 6. Notes | 0/TBD | Not started | - |
| 7. Promote to Backlog | 0/TBD | Not started | - |
