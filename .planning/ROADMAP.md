# Roadmap: Currents — GitHub Issues Browser + Triage

## Overview

This milestone adds a first-class GitHub Issues browser and triage workflow to Currents. The build is entirely additive: one new DB table, new API routes following existing patterns, and new React routes. The journey moves from infrastructure safety (rate-limit handling and schema migration) through a single-repo issues browser, cross-repo unified view, triage actions, notes posted as GitHub comments, and finally issue promotion into the Kanban backlog.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Rate-limit safety, DB migration, and triage API routes — prerequisites for all GitHub calls
- [ ] **Phase 2: Single-Repo Issues Browser** - Per-product issues list with filters, search, pagination, and detail panel
- [ ] **Phase 3: Cross-Repo Unified View** - Server-side fan-out aggregating all repos into one list with partial-failure handling
- [ ] **Phase 4: Triage Actions** - Internal priority, triaged toggle, keyboard navigation, and closed-issue warning
- [ ] **Phase 5: Notes** - Idempotent note posting as GitHub comments with success/failure feedback
- [ ] **Phase 6: Promote to Backlog** - One-action promotion to Kanban task with live write-back and duplicate guard

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
- [ ] 01-01-PLAN.md — Vitest config + GitHubRateLimitError class + githubFetch() rate-limit detection + unit tests
- [ ] 01-02-PLAN.md — 011_issue_triage DB migration + triage.ts DB helpers (getTriageRecord, upsertTriageRecord) + unit tests
- [ ] 01-03-PLAN.md — Triage API routes (GET + PUT) + issues proxy filter extension (labels, assignee) + rate-limit catch

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
**Plans**: TBD
**UI hint**: yes

### Phase 3: Cross-Repo Unified View
**Goal**: Users can see all GitHub issues from every connected product repo in a single list, with clear origin labelling and graceful partial failure
**Depends on**: Phase 2
**Requirements**: CROSS-01, CROSS-02, CROSS-03
**Success Criteria** (what must be TRUE):
  1. User can navigate to a top-level "Issues" view and see issues from all connected repos aggregated in one list
  2. Each issue card in the unified list displays a colour badge identifying which product repo it belongs to
  3. When one repo's GitHub request fails, the user sees a per-repo error indicator for that repo while the other repos' issues still load and display
**Plans**: TBD
**UI hint**: yes

### Phase 4: Triage Actions
**Goal**: Users can assign internal priority and mark issues as triaged directly inside Currents, with keyboard shortcuts and safety warnings — without touching the GitHub issue
**Depends on**: Phase 2
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, TRIAGE-06
**Success Criteria** (what must be TRUE):
  1. User can toggle an issue as triaged and assign it a priority (Critical / High / Medium / Low) from the detail panel; both actions are stored only in Currents
  2. Triage state and priority survive browser refresh and are immediately visible to all team members without a page reload
  3. Issues that have been triaged display a visual badge on their card in the issue list
  4. User can move through issues in the triage panel using `j` (next) and `k` (previous) keyboard shortcuts
  5. When the user attempts to triage or act on a closed GitHub issue, a warning is shown before the action proceeds
**Plans**: TBD
**UI hint**: yes

### Phase 5: Notes
**Goal**: Users can write and post an internal note on any issue that is added as a comment on the GitHub issue, with no risk of duplicates on retry
**Depends on**: Phase 1, Phase 4
**Requirements**: NOTES-01, NOTES-02, NOTES-03
**Success Criteria** (what must be TRUE):
  1. User can write a note in the detail panel and post it; the note appears as a comment on the linked GitHub issue
  2. If the user retries a failed note post, only one GitHub comment is created — the `github_comment_id` idempotency guard prevents duplicates
  3. After posting, the user sees a clear success confirmation or, on failure, an actionable error message
**Plans**: TBD
**UI hint**: yes

### Phase 6: Promote to Backlog
**Goal**: Users can promote a GitHub issue to a Currents backlog task in one action, with the task staying live-synced to the issue and all promotion safeguards in place
**Depends on**: Phase 4, Phase 5
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
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Single-Repo Issues Browser | 0/TBD | Not started | - |
| 3. Cross-Repo Unified View | 0/TBD | Not started | - |
| 4. Triage Actions | 0/TBD | Not started | - |
| 5. Notes | 0/TBD | Not started | - |
| 6. Promote to Backlog | 0/TBD | Not started | - |
