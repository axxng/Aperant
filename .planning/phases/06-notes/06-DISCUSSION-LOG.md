# Phase 6: Notes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 06-notes
**Areas discussed:** Note section placement, Note body storage, Idempotency + token fix, Post feedback UX

---

## Note section placement

| Option | Description | Selected |
|--------|-------------|----------|
| Below triage, above body | Textarea between triage controls and meta section, visible without scrolling | ✓ |
| Below issue body (bottom) | Textarea at the very bottom, after markdown body | |
| Collapsible section | Collapsed "Add Note" toggle, click to expand | |

**User's choice:** Below triage, above body (recommended)
**Notes:** Keeps all actions grouped at the top of the panel; visible without scrolling.

---

## Note body storage

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral textarea | Body not stored in Currents DB; textarea clears after post | ✓ |
| Persisted in Currents DB | Note body saved in new column; panel shows "Last note" after posting | |

**User's choice:** Ephemeral textarea (recommended)
**Notes:** No new DB column required. Users see their note via "View on GitHub" link.

---

## Idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side check | Check `github_comment_id` before calling GitHub; save after posting | ✓ |
| Client-side only | Disable button after success; fragile on page refresh | |

**User's choice:** Server-side check (recommended)
**Notes:** Prevents duplicates across page refreshes and retries, not just within a session.

---

## Per-user token fix

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix in Phase 6 | comment.ts uses posting user's OAuth token | ✓ |
| Leave as global token | Keep GITHUB_TOKEN env var for now | |

**User's choice:** Yes, fix in Phase 6 (recommended)
**Notes:** Completes Phase 3 D-12/D-13 intent for comment.ts. Comments appear as the individual user on GitHub.

---

## Post feedback UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline state + toast | Button transitions Post → Sent ✓, textarea clears, success toast | ✓ |
| Toast only | Success/failure toast; textarea clears on success | |

**User's choice:** Inline state + toast (recommended)
**Notes:** Richer feedback; failure case preserves textarea text so user can retry without retyping.

---

## Note length

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Validate non-empty only | ✓ |
| Limit to 1000 chars | Show character counter; validate client + server | |

**User's choice:** No limit (recommended)
**Notes:** GitHub comments have no hard limit (65536 chars); no artificial constraint.

---

## Claude's Discretion

- Exact textarea row height (3–5 rows)
- Whether the note section has a heading label or is unlabelled
- Exact toast wording for success
- Whether "Sent ✓" uses a local `useState` timer or `useMutation.isSuccess` state

## Deferred Ideas

- Full comment thread display in panel — NOTES-V2-01, deferred (high API cost)
- Note editing/deletion — not in scope
- Per-user comment attribution in panel — not in scope
