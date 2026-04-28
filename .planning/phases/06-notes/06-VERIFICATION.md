---
phase: 06-notes
verified: 2026-04-22T14:11:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Note section placement — open any issue in the detail panel and confirm the textarea labeled 'Add a note' appears between the triage controls row and the labels/assignees/date meta section"
    expected: "Textarea visible between triage row and meta divider, matching D-01 layout spec"
    why_human: "Visual placement cannot be confirmed from code alone; JSX position is correct but rendered layout may differ"
  - test: "Post Note button disabled state — with textarea empty, confirm the Post Note button is disabled (greyed out); then type text and confirm it becomes enabled"
    expected: "Button is disabled when noteText.trim() === '' and enabled when text is present"
    why_human: "Disabled attribute and visual state need browser rendering; unit tests verify this behavior but UI rendering should be confirmed"
  - test: "Success feedback — type a note, click Post Note, confirm: textarea clears, button shows 'Sent' with checkmark for ~2 seconds, success toast 'Note posted to GitHub' appears"
    expected: "All three feedback mechanisms fire on success (NOTES-03, D-05)"
    why_human: "Timer-based sent state and toast visibility are real-time UI behaviors not fully testable without browser"
  - test: "Idempotency guard — post a note on an issue, then navigate away and return to the same issue, type any text and click Post Note again; confirm only one GitHub comment is created (server returns alreadyPosted:true, UI still shows success)"
    expected: "Server returns { alreadyPosted: true, commentId } on retry; no duplicate GitHub comment; UI shows same success feedback (NOTES-02)"
    why_human: "Requires end-to-end browser flow with MOCK_SERVICES=true to observe idempotency across navigation"
  - test: "Error feedback — simulate network failure (block /api/github/repos/*/comment in DevTools), attempt to post a note; confirm error toast 'Could not post note. Try again.' appears and textarea text is preserved (D-05)"
    expected: "toastError fires with correct message; noteText state not cleared on failure"
    why_human: "Requires browser DevTools to simulate network failure; error branch cannot be triggered by unit tests alone"
  - test: "Per-user token attribution — in mock mode, verify the comment response includes html_url with the expected GitHub format"
    expected: "Comment mock returns html_url matching https://github.com/{owner}/{repo}/issues/{number}#issuecomment-{id}"
    why_human: "Token attribution requires real browser request through mock server; per-user OAuth token correctness verified by unit test but end-to-end flow needs browser confirmation"
---

# Phase 6: Notes Verification Report

**Phase Goal:** Users can write and post an internal note on any issue that is added as a comment on the GitHub issue, with no risk of duplicates on retry
**Verified:** 2026-04-22T14:11:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can write a note in the detail panel and post it; the note appears as a comment on the linked GitHub issue | ✓ VERIFIED | `IssueDetailPanel.tsx` has `noteMutation` calling `authenticatedFetch('/github/repos/${owner}/${repo}/issues/${number}/comment', { method: 'POST' })`; `comment.ts` handler posts to GitHub API; all 9 API tests + 4 NOTES-01 frontend tests GREEN |
| 2 | If the user retries a failed note post, only one GitHub comment is created — the `github_comment_id` idempotency guard prevents duplicates | ✓ VERIFIED | `comment.ts` calls `getTriageRecord` before GitHub API call; returns `{ alreadyPosted: true, commentId }` when `githubCommentId` already set; `upsertTriageRecord` saves `commentId` after successful post; 3 idempotency tests GREEN |
| 3 | After posting, the user sees a clear success confirmation or, on failure, an actionable error message | ✓ VERIFIED | `noteMutation.onSuccess` calls `setNoteText('')`, `setSent(true)`, `toastSuccess(t('notes.postSuccess'))`; `onError` calls `toastError(t('notes.postError'))` preserving `noteText`; 3 NOTES-03 frontend tests GREEN |

**Score:** 5/5 must-haves verified (roadmap truths + merged plan truths below)

### Merged Plan Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 4 | Textarea UI component exists following Input pattern (forwardRef, cn(), resize-none) | ✓ VERIFIED | `apps/web/src/client/components/ui/textarea.tsx` exists, 27 lines, `React.forwardRef`, `cn()`, `resize-none`, `Textarea.displayName = 'Textarea'` |
| 5 | en/fr issues.json have all 6 required notes i18n keys | ✓ VERIFIED | Both files contain `notes.sectionLabel`, `notes.placeholder`, `notes.postButton`, `notes.sentButton`, `notes.postSuccess`, `notes.postError`; both JSON files parse successfully |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` | Idempotency guard + per-user token + upsertTriageRecord after post | ✓ VERIFIED | 77 lines; imports `getUserById`, `getTriageRecord`, `upsertTriageRecord`; no `githubFetch` import; uses `dbUser.github_token` in Authorization header |
| `apps/web/api/_lib/db/triage.ts` | Extended upsertTriageRecord with githubCommentId + commentStatus | ✓ VERIFIED | Signature extended with `githubCommentId?: number | null` and `commentStatus?: 'posted' | 'failed' | null`; SQL includes both columns with conditional expressions |
| `apps/web/src/client/components/ui/textarea.tsx` | Textarea component: React.forwardRef, cn(), resize-none | ✓ VERIFIED | File exists, 27 lines, all required patterns present |
| `apps/web/src/shared/i18n/locales/en/issues.json` | notes.* i18n keys in English | ✓ VERIFIED | 6 keys present at `notes.*` path; JSON valid |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | notes.* i18n keys in French | ✓ VERIFIED | 6 keys present at `notes.*` path; JSON valid; French translations present |
| `apps/web/src/client/components/IssueDetailPanel.tsx` | Note section: useState, Textarea, noteMutation, sent state | ✓ VERIFIED | `useState` imported; `Textarea` from `./ui/textarea` imported; `noteMutation` declared with `useMutation`; `noteText`/`sent` state; `note-textarea` id in JSX |
| `apps/web/scripts/mocks/github-fixtures.ts` | Mock POST comment route saving idempotency guard to dev.db | ✓ VERIFIED | `upsertTriageRecord` imported and called; `POST /api/github/repos/:owner/:repo/issues/:number/comment` route registered |
| `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` | 9 API unit tests GREEN | ✓ VERIFIED | All 9 tests pass: 405, 400, 401, happy path, 403 no token, per-user token header, alreadyPosted early return, no-fetch guard, save commentId |
| `apps/web/api/_lib/db/triage.test.ts` | NOTES-02 comment fields describe block GREEN | ✓ VERIFIED | 2 tests pass: saves githubCommentId and commentStatus; preserves existing when not in updates |
| `apps/web/src/client/components/IssueDetailPanel.test.tsx` | 7 NOTES stubs GREEN | ✓ VERIFIED | All 7 tests pass: textarea render, button disabled/enabled, mutate args, onSuccess clear+toast, onSuccess Sent state, onError preserve+toast |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `IssueDetailPanel.tsx` | `apps/web/src/client/components/ui/textarea.tsx` | `import { Textarea } from './ui/textarea'` | ✓ WIRED | Line 9; Textarea used in JSX at line 274 |
| `IssueDetailPanel.tsx` | `/api/github/repos/{owner}/{repo}/issues/{number}/comment` | `authenticatedFetch` in `noteMutation.mutationFn` | ✓ WIRED | Lines 108-109; `authenticatedFetch('/github/repos/${vars.owner}/${vars.repo}/issues/${vars.number}/comment', { method: 'POST' })` |
| `comment.ts` | `apps/web/api/_lib/db/triage.ts` | `getTriageRecord + upsertTriageRecord` | ✓ WIRED | Line 8 import; `getTriageRecord` called at line 39, `upsertTriageRecord` called at line 66 |
| `comment.ts` | `apps/web/api/_lib/db/users.ts` | `getUserById(user.userId)` | ✓ WIRED | Line 7 import; called at line 33 |
| `comment.test.ts` | `comment.ts` | `import handler from './comment.js'` | ✓ WIRED | Test file imports handler; all 9 tests invoke it |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `IssueDetailPanel.tsx` note section | `noteText` (textarea value) | `useState('')` — ephemeral React state typed by user | N/A — user input, not fetched | ✓ FLOWING — user types note, `noteMutation.mutate` sends to API |
| `comment.ts` | `dbUser.github_token` | `getUserById(user.userId)` — DB lookup | Yes — reads `github_token` from `users` table | ✓ FLOWING |
| `comment.ts` | `existing.githubCommentId` | `getTriageRecord(repo, issueNumber)` — DB query | Yes — reads `github_comment_id` from `issue_triage` table | ✓ FLOWING |
| `comment.ts` | `comment` (GitHub response) | `fetch()` to GitHub API | Yes — returns real GitHub comment JSON | ✓ FLOWING |

### Behavioral Spot-Checks

Full test suite run: 125/125 tests pass (all 16 test files GREEN).

| Behavior | Result | Status |
|----------|--------|--------|
| comment.ts 9 API tests | 9/9 passed | ✓ PASS |
| triage.ts NOTES-02 tests | 2/2 passed | ✓ PASS |
| IssueDetailPanel NOTES-01 tests (4) | 4/4 passed | ✓ PASS |
| IssueDetailPanel NOTES-03 tests (3) | 3/3 passed | ✓ PASS |
| Full test suite | 125/125 passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTES-01 | 06-01, 06-02, 06-03 | User can write and post a note as a GitHub comment | ✓ SATISFIED | Textarea renders in IssueDetailPanel; noteMutation posts to comment.ts; 4 frontend tests + 4 API tests green |
| NOTES-02 | 06-01, 06-02 | Posting the same note twice does not create a duplicate GitHub comment | ✓ SATISFIED | getTriageRecord idempotency check in comment.ts; upsertTriageRecord saves commentId; 3 idempotency tests green |
| NOTES-03 | 06-01, 06-03 | User sees success or failure feedback after posting a note | ✓ SATISFIED | onSuccess: clears textarea + sent state + success toast; onError: preserves text + error toast; 3 feedback tests green |

**Note on REQUIREMENTS.md traceability:** The traceability table in REQUIREMENTS.md maps NOTES-01/02/03 to "Phase 5" but the ROADMAP.md and all plan frontmatter map them to Phase 6 (06-notes). This is a documentation inconsistency in REQUIREMENTS.md — the actual implementation is in Phase 6 as per ROADMAP. No functional gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `comment.ts` | 32, 44 | Comments referencing `githubFetch` as "do NOT use" — not a stub, clarifying documentation | ℹ️ Info | None — comments are explanatory, no githubFetch import exists |
| `triage.ts` | 100, 103 | `placeholders` variable name — not a stub indicator, is a SQL IN clause builder | ℹ️ Info | None — pre-existing pattern, not introduced in Phase 6 |

No blockers or warnings found.

### Human Verification Required

Plan 06-04 is a `type: human-verify` plan. The SUMMARY for plan 04 reports "Human approved all 6 verification steps." However, this verification cannot be confirmed from code alone. The following tests should be performed to close the human checkpoint.

#### 1. Note Section Placement (NOTES-01 / D-01)

**Test:** Start dev server with `MOCK_SERVICES=true`, open any issue detail panel, observe layout between triage controls and meta section
**Expected:** Textarea labeled "Add a note" visible between triage row and labels/assignees/date meta section
**Why human:** Visual layout cannot be confirmed from code; JSX position is correct but actual rendered position needs browser confirmation

#### 2. Post Note Disabled State (D-06)

**Test:** With the note textarea empty, confirm the Post Note button is disabled; then type text, confirm it becomes enabled
**Expected:** Button `disabled` attribute present when `noteText.trim() === ''`; removed when text present
**Why human:** Visual disabled state and interaction need browser rendering to confirm

#### 3. Success Feedback (NOTES-03 / D-05)

**Test:** Type a note and click Post Note; observe button text transitions to "Sent" with checkmark icon for ~2 seconds, then resets; observe success toast "Note posted to GitHub"; observe textarea clears
**Expected:** All three feedback mechanisms fire sequentially
**Why human:** Timer-based UI transitions and toast visibility are real-time behaviors not fully captured by unit tests

#### 4. Idempotency Guard (NOTES-02 / D-03)

**Test:** Post a note on an issue; navigate away; return to the same issue; type text and click Post Note again; confirm no duplicate GitHub comment and the UI shows success (not an error)
**Expected:** Server returns `{ alreadyPosted: true }` on retry; UI shows same success UX
**Why human:** Requires end-to-end browser flow to observe idempotency across navigation with MOCK_SERVICES=true

#### 5. Error Feedback (NOTES-03 / D-05)

**Test:** Block the `/api/github/repos/*/comment` request in browser DevTools; attempt to post a note; confirm error toast "Could not post note. Try again." and textarea text is preserved
**Expected:** `toastError` fires; `noteText` not cleared
**Why human:** Network failure simulation requires browser DevTools; onError behavior confirmed by unit test but end-to-end UX should be validated

#### 6. Per-User Token (D-04)

**Test:** In mock mode, observe the response includes `html_url` with correct GitHub issue comment format
**Expected:** `html_url` matches `https://github.com/{owner}/{repo}/issues/{number}#issuecomment-{id}`
**Why human:** Per-user token correctness verified by unit test; end-to-end response format needs browser confirmation

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria truths are verified. All required artifacts exist, are substantive, and are wired. All 125 automated tests pass including all 17 NOTES-specific stubs (9 API + 2 triage DB + 4 NOTES-01 frontend + 3 NOTES-03 frontend = 18 NOTES tests, all green).

The phase is blocked only by the pending human verification checkpoint (plan 06-04, `type: human-verify`). The SUMMARY claims approval but this verifier cannot confirm browser interaction from code. The human verification items above are the exact 6 steps from plan 06-04's checkpoint.

---

_Verified: 2026-04-22T14:11:00Z_
_Verifier: Claude (gsd-verifier)_
