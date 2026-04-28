# Phase 6: Notes - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds a note-posting capability to the existing issue detail panel. After this phase:
- Users can write a note in `IssueDetailPanel` and post it as a GitHub comment on the linked issue
- A server-side idempotency guard (using the existing `github_comment_id` column) prevents duplicate comments even if the user retries after a network failure or page refresh
- The user sees a clear success confirmation (inline button state + toast) or, on failure, an actionable error toast with the note body preserved
- `comment.ts` is updated to use the posting user's per-user OAuth token (completing Phase 3 D-12/D-13 intent for this route)

No note body storage in Currents DB. No backlog promotion (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Note Section Placement (D-01)
- **D-01:** The note textarea section sits **between the triage controls and the meta section** (labels/assignees/date), above the markdown body. This keeps all actions grouped at the top, visible without scrolling.
- Layout: a textarea followed by a "Post Note" button on its own row, separated from triage by the existing divider.

### Note Body Storage (D-02)
- **D-02:** **Ephemeral only.** The note body is NOT stored in Currents DB. User types, posts, textarea clears. No new DB column required. To re-read a posted note, the user clicks "View on GitHub."
- The existing `github_comment_id` and `comment_status` columns on `issue_triage` are sufficient — they track whether a comment was posted, not what it said.

### Idempotency Mechanism (D-03)
- **D-03:** **Server-side check in `comment.ts`.** Before calling the GitHub API:
  1. Check the triage record for `github_comment_id`
  2. If set → return `{ alreadyPosted: true, commentId }` without calling GitHub (no duplicate)
  3. If not set → call GitHub API → save `github_comment_id` + `comment_status: 'posted'` to triage record → return comment data
- This prevents duplicates even across page refreshes or multiple retries — client-side button disabling alone is insufficient for NOTES-02.

### Per-User Token Fix (D-04)
- **D-04:** `comment.ts` must use the **authenticated user's `github_token`** from the DB (read via `userId` from JWT payload), not the global `GITHUB_TOKEN` env var.
- Consistent with Phase 3 D-12/D-13 intent. Comments are posted as the individual user on GitHub, not as a shared token owner.
- Pattern: look up `github_token` from `users` table using `user.userId` after `authenticateRequest`, then pass it as the Authorization header to `githubFetch` (or inline fetch call).

### Post Feedback UX (D-05)
- **D-05:** On **success**: textarea clears + button transitions `Post Note → Sent ✓` (briefly, ~2s) → resets to `Post Note` + a success toast: "Note posted to GitHub".
- On **failure**: toast error "Could not post note. Try again." + textarea preserves the user's text (so they can retry without retyping).
- Matches the existing triage `toastError()` pattern from Phase 5.

### Note Validation (D-06)
- **D-06:** Validate that the note body is non-empty (client-side: disable "Post Note" button when textarea is empty; server-side: `githubCommentSchema` already validates `body` is non-empty). No character limit.

### Claude's Discretion
- Exact textarea row height (3–5 rows is reasonable)
- Whether the note section uses a labelled heading ("Note" or "Add a note") or is unlabelled
- Exact toast wording for success (e.g., "Note posted to GitHub" or "Note posted as GitHub comment")
- Whether `Sent ✓` is implemented via a local `useState` timer or the `useMutation.isSuccess` state

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Note API Route
- `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` — existing POST route; needs idempotency guard (D-03) and per-user token fix (D-04)

### Triage DB (idempotency columns)
- `apps/web/api/_lib/db/triage.ts` — `TriageRecord.githubCommentId`, `TriageRecord.commentStatus`; `upsertTriageRecord()` accepts these fields; add a new helper or extend upsert to update `github_comment_id` + `comment_status` after posting
- `apps/web/api/triage/[owner]/[repo]/[number].ts` — existing GET/PUT triage route; may need a variant to update comment metadata only

### Existing Issues UI
- `apps/web/src/client/components/IssueDetailPanel.tsx` — the panel to extend; note section inserts between triage section and meta divider
- `apps/web/src/client/components/IssueDetailPanel.test.tsx` — extend tests for note section (TDD: write failing tests first per engineering principle 4)

### Auth Helpers
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest()` returns `{ userId, email, role }` — use `userId` to look up `github_token` from users table
- `apps/web/api/_lib/db/users.ts` — look here for user lookup by ID to retrieve `github_token`

### Validation
- `apps/web/api/_lib/validation.ts` — `githubCommentSchema` already validates `body` is non-empty; `githubOwnerRepoSchema` for path params

### Engineering Principles (MANDATORY)
- `CLAUDE.md` — 4-step handler shape (parse → authorize → pure domain logic → respond), parse-don't-validate, TDD (write failing test first), FSM/discriminated unions, mocked services

### i18n
- `apps/web/src/shared/i18n/locales/en/issues.json` — add note keys here (e.g., `notes.placeholder`, `notes.postButton`, `notes.postSuccess`, `notes.postError`)
- `apps/web/src/shared/i18n/locales/fr/issues.json` — same keys in French

### Mock Services
- `scripts/mocks/github-fixtures.ts` — add a mock handler for `POST /api/github/repos/:owner/:repo/issues/:number/comment` so note posting works under `MOCK_SERVICES=true`

### Requirements
- `.planning/REQUIREMENTS.md` — NOTES-01, NOTES-02, NOTES-03 define the acceptance criteria for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IssueDetailPanel.tsx` — extend by inserting the note section between triage `<div>` and the meta divider; the `issue` prop already has `repoFullName` to derive `owner/repo`
- `authenticatedFetch()` in `src/client/lib/api-client.ts` — use for the POST comment mutation (same pattern as triage PUT)
- `useToast()` hook — already imported in `IssueDetailPanel`; use `toast()` (success variant) and `error()` for feedback
- `useMutation` from TanStack Query — established pattern for mutations with optimistic state (see triage mutation in `IssueDetailPanel`)
- `Button`, `Textarea` (if it exists in `src/client/components/ui/`) — use existing UI components; add `Textarea` if not present

### Established Patterns
- Triage mutation in `IssueDetailPanel.tsx` — exact pattern to follow for note `useMutation`: `mutationFn`, `onSuccess`, `onError`
- `toastError(t('triage.saveError'))` — error toast call pattern
- 4-step handler shape in `comment.ts` — already follows the shape; extend for idempotency guard
- `githubOwnerRepoSchema.parse(req.query)` + `z.string().regex(/^\d+$/).parse(...)` — path param parsing pattern already in `comment.ts`

### Integration Points
- `comment.ts` — the route needs two additions: (1) read triage record for `github_comment_id` before posting, (2) update triage record with `github_comment_id` after posting; also fix the token to use per-user OAuth
- `upsertTriageRecord()` — already accepts `{ isTriaged?, priority? }` — need to also accept `{ githubCommentId?, commentStatus? }` to save idempotency state after posting

</code_context>

<specifics>
## Specific Ideas

- Panel layout (D-01):
  ```
  [Triaged ✓] [Priority: High ▾]   ← existing triage row

  ──────────
  [Note textarea (3-5 rows)        ]
  [                                 ]
  [Post Note]                        ← right-aligned or full-width
  ──────────
  labels / assignee / date
  View on GitHub
  ──────────
  Markdown body...
  ```
- The "Post Note" button should be disabled when the textarea is empty (D-06) and when the mutation is pending
- On the server side, after a successful GitHub comment POST, call something like `upsertTriageRecord(repo, number, { githubCommentId: commentId, commentStatus: 'posted' })` to save the idempotency guard

</specifics>

<deferred>
## Deferred Ideas

- Displaying the full comment thread in the panel (NOTES-V2-01 — high API cost per issue, deferred)
- Editing or deleting a posted note — not in scope for this phase
- Per-user comment attribution in the panel (showing which Currents user posted the note)

</deferred>

---

*Phase: 06-notes*
*Context gathered: 2026-04-22*
