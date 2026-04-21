# Requirements: Currents

**Defined:** 2026-04-21
**Core Value:** A team can run a full triage session — browse issues from all connected repos, assign priority, leave notes, and promote the right ones to the backlog — entirely inside Currents.

## v1 Requirements

### Browse — Single-repo issues browser

- [ ] **BROWSE-01**: User can view open GitHub issues for a connected product repo
- [ ] **BROWSE-02**: User can view closed GitHub issues for a connected product repo
- [ ] **BROWSE-03**: User can filter issues by one or more labels (multi-select)
- [ ] **BROWSE-04**: User can filter issues by assignee
- [ ] **BROWSE-05**: User can search issues by keyword in title
- [ ] **BROWSE-06**: User can open an issue detail panel showing rendered Markdown body, labels, assignee, and created date
- [ ] **BROWSE-07**: User can load more issues using a "Load More" button (50 issues per page)
- [ ] **BROWSE-08**: User can navigate to the original issue on github.com from the detail panel

### Cross — Cross-repo unified view

- [ ] **CROSS-01**: User can view all GitHub issues from every connected product repo in a single unified list
- [ ] **CROSS-02**: Each issue in the unified list shows a product color badge indicating which repo it belongs to
- [ ] **CROSS-03**: When one repo's GitHub request fails, other repos' issues still display with a per-repo error indicator

### Triage — Internal triage state

- [ ] **TRIAGE-01**: User can mark an issue as triaged (stored in app only, not pushed to GitHub)
- [ ] **TRIAGE-02**: User can assign internal priority (Critical / High / Medium / Low) to an issue without creating a GitHub label
- [ ] **TRIAGE-03**: Triage state persists across browser refresh and is visible to all team members
- [ ] **TRIAGE-04**: Triaged issues show a visual badge on their issue card
- [ ] **TRIAGE-05**: User can navigate between issues using `j`/`k` keyboard shortcuts in the triage panel
- [ ] **TRIAGE-06**: User is warned when attempting to triage or act on a closed GitHub issue

### Notes — Notes posted as GitHub comments

- [ ] **NOTES-01**: User can write and post a note on an issue that is added as a comment on the linked GitHub issue
- [ ] **NOTES-02**: Posting the same note twice (e.g., after a network retry) does not create a duplicate GitHub comment
- [ ] **NOTES-03**: User sees success or failure feedback after posting a note

### Promote — Promote to backlog task

- [ ] **PROMOTE-01**: User can promote a GitHub issue to a Currents backlog task in one action from the triage panel
- [ ] **PROMOTE-02**: Promoted task stays live-synced with the GitHub issue — edits in Currents write back to GitHub via the existing write-back mechanism
- [ ] **PROMOTE-03**: An already-promoted issue shows a "View in Backlog" badge linking to the Kanban task instead of a promote button
- [ ] **PROMOTE-04**: Internal triage priority pre-populates the task priority during promotion
- [ ] **PROMOTE-05**: The same GitHub issue cannot be promoted to a task twice (duplicate promotion guard)

### Infra — Foundation

- [ ] **INFRA-01**: When GitHub's rate limit is reached, users see an actionable error message (not a generic failure) indicating when they can retry
- [ ] **INFRA-02**: Triage state DB table is created in a single migration with all required columns, including comment idempotency fields (`github_comment_id`, `comment_status`)

## v2 Requirements

### Triage — Deferred UX

- **TRIAGE-V2-01**: User can snooze an issue with a wake-up date (deferred — requires reliable scheduler)
- **TRIAGE-V2-02**: User can triage multiple issues in bulk with a single action

### Notes — Deferred

- **NOTES-V2-01**: User can view the full comment thread for an issue in the detail panel (deferred — high API call cost per issue)

### Discovery — Deferred

- **DISC-V2-01**: Duplicate issues are detected and surfaced (deferred — requires AI layer)

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI-powered issue investigation | No AI features in this milestone; layers on top once browse/triage flow is solid |
| GitHub PR review | Separate feature, separate milestone |
| GitLab integration | Separate milestone |
| Insights AI chat | Separate milestone |
| Roadmap & strategic planning | Separate milestone |
| Changelog generation | Separate milestone |
| Multiple repos per product | Schema change not justified for current team size; defer |
| Org-level GitHub connection | Per-product token model is sufficient |
| Custom GitHub label management | Labels live on GitHub; managing in Currents creates sync problems |
| Editing GitHub issues from Currents | Out of triage scope; write-back is triggered by task edits, not direct issue editing |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| BROWSE-01 | — | Pending |
| BROWSE-02 | — | Pending |
| BROWSE-03 | — | Pending |
| BROWSE-04 | — | Pending |
| BROWSE-05 | — | Pending |
| BROWSE-06 | — | Pending |
| BROWSE-07 | — | Pending |
| BROWSE-08 | — | Pending |
| CROSS-01 | — | Pending |
| CROSS-02 | — | Pending |
| CROSS-03 | — | Pending |
| TRIAGE-01 | — | Pending |
| TRIAGE-02 | — | Pending |
| TRIAGE-03 | — | Pending |
| TRIAGE-04 | — | Pending |
| TRIAGE-05 | — | Pending |
| TRIAGE-06 | — | Pending |
| NOTES-01 | — | Pending |
| NOTES-02 | — | Pending |
| NOTES-03 | — | Pending |
| PROMOTE-01 | — | Pending |
| PROMOTE-02 | — | Pending |
| PROMOTE-03 | — | Pending |
| PROMOTE-04 | — | Pending |
| PROMOTE-05 | — | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0 (populated by roadmapper)
- Unmapped: 27 ⚠️

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after initial definition*
