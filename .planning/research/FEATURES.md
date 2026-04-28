# Features Research — GitHub Issues Triage

**Domain:** GitHub Issues Browser + Triage workflow embedded in a multi-product backlog webapp
**Researched:** 2026-04-21
**Milestone scope:** ISSUES-01 through ISSUES-05 (browse, cross-repo view, triage, notes, promote)
**Overall confidence:** HIGH (backed by Linear/ZenHub docs, Kubernetes/VSCode triage guides, GitHub community discussions)

---

## Table Stakes (must-have)

These are the features users expect the moment they open an issues browser. Missing any of these sends them back to GitHub.

| Feature | Why Expected | Notes |
|---------|--------------|-------|
| List open issues per repo with title, number, labels, assignee, created date | Minimum legible issue list | Without this users see nothing useful |
| Filter by open / closed state | GitHub's most-used toggle; without it the list is unusable on repos with hundreds of closed issues | Must be the default view entry point |
| Search by keyword (title) | GitHub search is the first thing users reach for | Server-side filter via GitHub API `q=` param is sufficient |
| Filter by label | Teams use labels as primary issue taxonomy (bug, enhancement, needs-triage, etc.) | Multi-select; labels already returned by GitHub API |
| Filter by assignee | Essential for personal triage queues | Single-select is enough at MVP |
| Issue detail panel / drawer | Users need to read the issue body and comments to triage it | Inline panel preferred over full-page navigation; avoids losing list context |
| Link to GitHub issue | Escape hatch for edge cases; users will never fully trust a mirror without it | Opens in new tab from the detail panel |
| Pagination or infinite scroll | Repos with many open issues break without it | GitHub REST API returns max 100 per page; cursor-based or page-based both acceptable |
| Loading + empty states | Users need feedback when a repo has no issues or the GitHub token is missing | Show actionable error if token is absent |

**Confidence: HIGH** — These match GitHub's own default issue list capabilities, which is the baseline users compare against.

---

## Differentiators

What makes Currents better than just going to GitHub.

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| Internal priority assignment (ISSUES-03) | GitHub has no internal priority field separate from labels; teams add `priority: high` labels as a workaround. A first-class priority field that stays in Currents keeps GitHub clean. | Low — store in local DB, no GitHub write-back needed |
| Triaged / not-triaged status (ISSUES-03) | Gives teams a clear inbox-zero workflow. Every new issue starts as untriaged; triage session = work through the untriaged queue. | Low — single boolean or timestamp in local DB |
| Internal notes that post to GitHub as comments (ISSUES-04) | Teams want a single source of truth on GitHub. Posting triage notes as GitHub comments keeps the discussion where engineers work. | Medium — requires GitHub API write call; subject to rate limits |
| Cross-repo unified view (ISSUES-02) | GitHub has no org-wide issues list. Viewing all issues across all products without switching repos is the core pain point ZenHub and Triage Party solve. | Medium — parallel API calls per product repo, merged and sorted client-side |
| Promote to backlog task with live sync (ISSUES-05) | Bridges the gap between triage and execution; promoted issues join the Kanban board and stay in sync. No other tool in this category offers this within the same UI. | Medium — reuses existing write-back pattern |
| Snooze / defer (future) | Linear's most-loved triage UX; lets triagers say "revisit this in 2 weeks" without closing the issue | High — requires scheduled job to resurface issues; defer to future milestone |

**Confidence: HIGH** — These differentiators are validated by ZenHub multi-repo boards, Linear triage docs, and GitHub community discussions about the absence of cross-repo views.

---

## Triage Session Flow

What a good triage session looks like step by step. This is the UX contract the feature set must support.

**Entry point:** User navigates to the Issues section. Default view is the unified cross-repo list, filtered to untriaged + open issues. This is the team's triage inbox.

1. **Scan the list** — User sees untriaged open issues sorted by creation date (oldest first). Each row shows: repo badge, issue number, title, labels, assignee, age.

2. **Open an issue** — Click opens a detail panel (slide-in drawer). Panel shows: title, body (rendered Markdown), labels, assignee, milestone, creation date, a link to GitHub, and any existing Currents triage metadata (internal priority, triage note, triaged-by).

3. **Triage the issue** — User sets:
   - **Internal priority:** Critical / High / Medium / Low (or No Priority)
   - **Mark as triaged:** Checkbox or button. Records who triaged it and when.
   - Optionally adds an **internal note** (text field). On save, the note posts as a GitHub comment automatically.

4. **Decide on disposition:**
   - **Promote to backlog** — Creates a Currents task in the correct product's backlog with the live write-back link. The issue is marked as promoted in the issues view (de-emphasised or tagged). This is a one-way action.
   - **Leave in issues** — Issue remains in the list with triage metadata visible. Triaged issues are visually distinguished (e.g., muted row, checkmark).
   - **No action** — Close the panel and continue to the next issue.

5. **Move to next** — Keyboard shortcut (`j`/`k` or `n`/`p`) to navigate between issues without closing the panel. This is the key UX that makes bulk triage fast. Without it, triaging 30 issues requires 30 open/close cycles.

6. **Session complete** — All issues in the queue show triage metadata. The untriaged filter is now empty.

**Critical UX insight from Linear:** The "triage inbox" framing (separate view, not a filtered list bolted onto the main board) signals to the team that triaging is a distinct workflow with a clear done state. Untriaged issues should not appear on the Kanban board. They exist in a pre-backlog holding area.

**Confidence: MEDIUM** — Step-by-step flow synthesised from Linear triage docs, Kubernetes triage guidelines, and VSCode triage wiki. Specific keyboard shortcuts and panel behaviour are informed by observed patterns, not direct docs.

---

## Cross-Repo View Patterns

How multi-repo tools group and filter when showing issues across repositories.

**Primary grouping:** By default, show all repos merged into one flat list sorted by creation date descending (newest first). This gives a single stream that works for daily triage.

**Secondary grouping options teams expect:**
- **Group by repository / product** — Collapsible sections per product. Useful for product-owner triage where one person owns one repo.
- **Group by label** — E.g., see all `bug` issues across all repos together. Useful for theme-based triage ("let's clear all bugs this sprint").
- **Group by priority** — After an initial triage pass, allows prioritized planning view.

**Filter dimensions that matter in cross-repo context:**
| Filter | Notes |
|--------|-------|
| Product / repo | Multi-select; "All" is the default |
| State (open / closed) | Open is default |
| Triaged / untriaged | Core triage workflow filter |
| Label | Multi-select; labels are per-repo and may not be consistent across repos — show union of all labels |
| Assignee | Users are GitHub users; same person may appear across repos |
| Promoted to backlog (yes/no) | Lets triagers skip already-promoted issues |
| Search (keyword) | Searches titles only is sufficient at MVP; full-text body search requires GitHub search API (separate endpoint) |

**Label inconsistency is the cross-repo gotcha:** Each GitHub repo has its own label set. In a cross-repo view, the label filter must show the union of all labels, not assume consistency. At small team sizes (3–20 people, per PROJECT.md), teams typically standardise labels manually — but the UI must not break if labels differ.

**Sort orders teams expect:**
- Newest first (default, shows recent activity)
- Oldest first (classic inbox-zero drain)
- Most recently updated (surfaces stale discussions)
- Priority descending (post-triage planning view)

**Confidence: MEDIUM** — Cross-repo patterns drawn from ZenHub multi-repo board docs, Codetree guides, and GitHub community discussions. No single authoritative spec exists because GitHub itself doesn't offer this natively.

---

## Issue States Beyond Open / Closed

Triage-relevant states that teams track in addition to GitHub's binary open/closed.

| State | Where It Lives | How It's Set | Value |
|-------|---------------|-------------|-------|
| **Needs triage** (untriaged) | Currents DB | Default for all new issues seen | The triage inbox filter — separates "to do" from "done" |
| **Triaged** | Currents DB | Set by user during triage session | Signals reviewed; records who triaged and when |
| **Promoted to backlog** | Currents DB (task link) | Set when user promotes | Prevents duplicate promotions; shows in issue list |
| **Stale** | GitHub label / calculated | Last updated > N days (typically 30–90) | Surface issues going cold; prompt for close or action |
| **Awaiting response** | GitHub label (`awaiting-response`, `needs-info`) | Set manually or by triage automation | Shows issues blocked on reporter; can be auto-closed |
| **Snoozed** (future) | Currents DB | Set by user with a wake-up date | Hides issue until relevant; resurfaces at deadline |
| **Needs reproduction** | GitHub label convention | Set during triage | Bug-specific state; important for bug-heavy repos |
| **Duplicate** | GitHub close reason (since 2022) | Set on GitHub | GitHub now surfaces close reason via API; can filter these out |

**For MVP (ISSUES-01 to ISSUES-05):** The three states that matter are **untriaged**, **triaged**, and **promoted to backlog**. Everything else is nice-to-have. Stale detection can be approximated by surfacing issues not updated in 30+ days with a visual indicator (no separate DB state needed — calculate from `updated_at`).

**Confidence: HIGH** — Kubernetes triage guide, VSCode issues wiki, and GitHub's own `needs-triage` label usage across major OSS projects consistently use the untriaged/triaged/accepted pattern.

---

## Issue → Task Promotion

What data transfers and what linking behavior is expected when a GitHub issue becomes a Currents backlog task.

**Data that must transfer:**
| Field | Source | Notes |
|-------|--------|-------|
| Title | GitHub issue title | Pre-filled in task creation dialog; user can edit |
| Description | GitHub issue body | Rendered Markdown → plain text for task body |
| GitHub repo + issue number | GitHub issue URL/id | Stored as `github_owner`, `github_repo`, `github_issue_number` on the task |
| Labels | GitHub issue labels | Mapped to Currents task category where possible (e.g., `bug` → Bug category); otherwise ignored |
| Assignees | GitHub issue assignees | Not mapped at MVP — Currents uses email-based users, GitHub uses GitHub usernames; the mapping is non-trivial without an explicit user-linking feature |
| Internal priority | Currents triage metadata | If the issue was triaged and priority was set, pre-populate the task priority |

**What does NOT need to transfer:**
- Comments (history stays on GitHub, not duplicated in Currents)
- Milestones (no milestone concept in Currents tasks)
- GitHub Projects board columns (write-back handles the reverse direction)

**Linking behavior (critical):**
- Once promoted, edits to the Currents task title/body/status/labels/assignees sync back to GitHub via the existing `syncTaskToGitHub()` write-back mechanism. This is already built — the promotion step just wires up the foreign key.
- Closing the task (moving to Done column) should close the GitHub issue. This is the existing write-back behavior.
- Deleting a Currents task should NOT close or delete the GitHub issue. The issue lives independently on GitHub.
- If the GitHub issue is already closed when the user tries to promote it, warn and confirm — don't silently promote a closed issue.

**Preventing duplicate promotions:**
- A GitHub issue can only be promoted once. If it's already linked to a task, the promote button becomes "View in Backlog" (a link to the existing task). This is the expected behavior from ZenHub and similar tools.
- Store the task ID on the issue triage record to enable this lookup.

**Promotion entry point:**
- Promotion can happen from the issue detail panel (during triage) OR from the issue row in the list (quick-promote button). The quick-promote button should open a lightweight confirmation dialog with pre-filled fields, not a full task creation dialog with all fields.

**Confidence: HIGH** — The write-back pattern is already implemented in the codebase. Promotion behavior is consistent with ZenHub and GitHub Projects "convert to task" patterns. Assignee non-mapping is a deliberate simplification matching the project constraints.

---

## Anti-Features

Things to explicitly NOT build in this milestone, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Edit GitHub issue title/body from Currents** | Write-back already handles this for promoted tasks. For non-promoted issues, editing in Currents creates a confusing split-brain: is the issue in Currents or on GitHub? | Post a comment (ISSUES-04) and let users edit on GitHub directly |
| **Bulk triage actions (select all, bulk-prioritize)** | High complexity, low frequency. Teams triage 10–30 issues at a time, not thousands. Bulk actions add UI surface that confuses the core flow. | Keyboard navigation (j/k) through individual issues is faster and sufficient |
| **Custom label management (create/edit labels)** | Labels live on GitHub. Managing them in Currents creates a sync problem. | Read and display labels from GitHub; never write labels back except as part of the existing write-back sync |
| **Issue templates / forms** | Creation UI for new GitHub issues is not part of the triage use case and requires GitHub OAuth app scope escalation. | Out of scope; users create issues on GitHub |
| **Duplicate detection** | Linear offers this via LLM analysis. Without AI (this milestone), implementing it means string similarity matching with high false-positive rates. | Defer; add when AI layer is available in a future milestone |
| **Stale bot / automated closing** | A timer-based auto-close that runs in Currents would require a reliable scheduler and would surprise users when issues disappear. | Surface stale issues visually (age indicator); let users act manually |
| **GitHub Projects board sync for triage** | The existing GitHub Projects sync is for promoted tasks. Pulling triage state from/to GitHub Projects would require a new sync layer and complicates the clear boundary between "untriaged issues" and "backlog tasks". | Keep the boundary clean: issues are pre-backlog, tasks are in the backlog |
| **Per-issue comment thread display** | Fetching and rendering all comments in the detail panel requires additional API calls per issue and paginated comment fetch. The body + metadata is enough to triage. | Show a "View all comments on GitHub" link; fetch comments only if explicitly requested |
| **Mention notifications / @mentions** | Out of scope; requires webhook infrastructure not present in the Vercel serverless + polling model. | Comments posted via ISSUES-04 will show up in GitHub notifications naturally |

---

## Complexity Notes

Implementation effort guidance for the roadmap builder.

| Feature | Effort | Bottleneck |
|---------|--------|------------|
| Issue list per repo with filters (ISSUES-01) | Low | GitHub REST API `/repos/{owner}/{repo}/issues` already in the proxy. Add filter params and a new UI route. |
| Cross-repo unified list (ISSUES-02) | Medium | Requires parallel fetching from N product repos (one per product), merging results, deduplicating pagination, and client-side sort. N is bounded by number of products (small teams, likely < 10). |
| Triage state storage (ISSUES-03) | Low | New DB table: `issue_triage` (github_owner, github_repo, issue_number, priority, triaged_by, triaged_at, promoted_task_id). Single endpoint to read/write. |
| Internal notes → GitHub comments (ISSUES-04) | Low-Medium | POST to `/repos/{owner}/{repo}/issues/{number}/comments`. Rate limit concern: GitHub allows 5000 requests/hour per token (PAT), 80 req/min secondary rate limit. Fine for team sizes in scope. Error handling required. |
| Issue detail panel (Markdown rendering) | Low | `react-markdown` or similar; already available in the ecosystem. No new infrastructure. |
| Promote to task (ISSUES-05) | Medium | New API endpoint that: (1) creates a task, (2) sets the github link fields, (3) marks issue as promoted in `issue_triage`. Reuses `syncTaskToGitHub()`. The task creation part is an existing endpoint. The new part is the atomic bundle. |
| Keyboard navigation in triage panel | Low | React state machine (currentIndex). No backend changes. High UX value for low engineering cost. |
| Stale indicator (age-based, no DB state) | Low | Calculate in client from `updated_at` field already returned by GitHub API. |
| Snooze with wake-up scheduling | High | Requires either a Vercel cron that checks snooze dates and re-surfaces issues, or a client-side timer that only works in-session. Neither is clean. **Defer.** |
| Pagination for issue list | Low-Medium | GitHub API page + per_page params. Client needs page controls or infinite scroll. |

**Overall milestone complexity:** Medium. The hardest part is the cross-repo merge (ISSUES-02) and the atomic promote-to-task (ISSUES-05). Both are bounded problems with clear patterns. No new infrastructure is required beyond a new DB table and a handful of API routes.

---

## Sources

- [Linear Triage Docs](https://linear.app/docs/triage) — HIGH confidence
- [Kubernetes Issue Triage Guidelines](https://www.kubernetes.dev/docs/guide/issue-triage/) — HIGH confidence
- [VSCode Issues Triaging Wiki](https://github.com/microsoft/vscode/wiki/Issues-Triaging) — HIGH confidence
- [ZenHub Multi-Repo Boards](https://www.zenhub.com/blog-posts/why-switch-from-github-projects) — MEDIUM confidence
- [Codetree: Managing Issues Across Multiple GitHub Repositories](https://codetree.com/guides/managing-issues-across-multiple-github-repositories) — MEDIUM confidence
- [GitHub Community: Managing Issues Across Multiple Repos](https://github.com/orgs/community/discussions/72720) — MEDIUM confidence
- [Zenhub: Best Practices for GitHub Issues](https://blog.zenhub.com/best-practices-for-github-issues/) — MEDIUM confidence
- [Dosu: Automating GitHub Issue Triage](https://dosu.dev/blog/automating-github-issue-triage) — LOW confidence (single source)
