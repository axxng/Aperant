# Requirements: Currents

**Defined:** 2026-04-21
**Core Value:** A team can run a full triage session — browse issues from all connected repos, assign priority, leave notes, and promote the right ones to the backlog — entirely inside Currents.

## v1 Requirements

### Browse — Single-repo issues browser

- [x] **BROWSE-01
**: User can view open GitHub issues for a connected product repo
- [x] **BROWSE-02
**: User can view closed GitHub issues for a connected product repo
- [x] **BROWSE-03
**: User can filter issues by one or more labels (multi-select)
- [x] **BROWSE-04
**: User can filter issues by assignee
- [x] **BROWSE-05**: User can search issues by keyword in title
- [x] **BROWSE-06**: User can open an issue detail panel showing rendered Markdown body, labels, assignee, and created date
- [x] **BROWSE-07**: User can load more issues using a "Load More" button (50 issues per page)
- [x] **BROWSE-08
**: User can navigate to the original issue on github.com from the detail panel

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

- [x] **INFRA-01**: When GitHub's rate limit is reached, users see an actionable error message (not a generic failure) indicating when they can retry
- [x] **INFRA-02**: Triage state DB table is created in a single migration with all required columns, including comment idempotency fields (`github_comment_id`, `comment_status`)

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| BROWSE-01 | Phase 2 | Complete |
| BROWSE-02 | Phase 2 | Complete |
| BROWSE-03 | Phase 2 | Complete |
| BROWSE-04 | Phase 2 | Complete |
| BROWSE-05 | Phase 2 | Complete |
| BROWSE-06 | Phase 2 | Complete |
| BROWSE-07 | Phase 2 | Complete |
| BROWSE-08 | Phase 2 | Complete |
| CROSS-01 | Phase 3 | Pending |
| CROSS-02 | Phase 3 | Pending |
| CROSS-03 | Phase 3 | Pending |
| TRIAGE-01 | Phase 4 | Pending |
| TRIAGE-02 | Phase 4 | Pending |
| TRIAGE-03 | Phase 4 | Pending |
| TRIAGE-04 | Phase 4 | Pending |
| TRIAGE-05 | Phase 4 | Pending |
| TRIAGE-06 | Phase 4 | Pending |
| NOTES-01 | Phase 5 | Pending |
| NOTES-02 | Phase 5 | Pending |
| NOTES-03 | Phase 5 | Pending |
| PROMOTE-01 | Phase 6 | Pending |
| PROMOTE-02 | Phase 6 | Pending |
| PROMOTE-03 | Phase 6 | Pending |
| PROMOTE-04 | Phase 6 | Pending |
| PROMOTE-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation — all 27 requirements mapped*
