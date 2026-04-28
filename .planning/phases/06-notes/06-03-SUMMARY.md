---
phase: "06-notes"
plan: "03"
subsystem: "apps/web"
tags: [tdd, green-phase, notes, frontend, i18n, react]
dependency_graph:
  requires: [06-01]
  provides: [NOTES-01-frontend, NOTES-03-frontend]
  affects:
    - apps/web/src/client/components/ui/textarea.tsx
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/scripts/mocks/github-fixtures.ts
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
tech_stack:
  added: []
  patterns: [forwardRef-component, useMutation-no-optimistic-update, mockImplementation-cycling, act-state-update]
key_files:
  created:
    - apps/web/src/client/components/ui/textarea.tsx
  modified:
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
    - apps/web/src/client/components/IssueDetailPanel.tsx
    - apps/web/scripts/mocks/github-fixtures.ts
    - apps/web/src/client/components/IssueDetailPanel.test.tsx
decisions:
  - "Used mockImplementation with call-count cycling (odd=triage, even=note) to handle two useMutation calls per render across re-renders — mockReturnValueOnce fails after first re-render"
  - "Stored noteMutation options in module-level ref (noteMutationOptionsRef) captured during mockImplementation to allow direct onSuccess/onError callback invocation in tests"
  - "Used act() for onSuccess/onError callback invocations that trigger React setState — required to flush state updates synchronously in jsdom"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-22T13:59:39Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 5
---

# Phase 6 Plan 03: Frontend Notes Implementation Summary

**One-liner:** Textarea UI component, notes i18n keys (en/fr), note section wired into IssueDetailPanel with noteMutation + sent state, mock POST comment route — all 7 NOTES TDD stubs turned GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Textarea component + add i18n keys (en + fr) | 09b52c5c | textarea.tsx, en/issues.json, fr/issues.json |
| 2 | Add note section to IssueDetailPanel + register mock route | 5347d4f7 | IssueDetailPanel.tsx, github-fixtures.ts, IssueDetailPanel.test.tsx |

## What Was Built

### Task 1: Textarea component + i18n keys

Created `apps/web/src/client/components/ui/textarea.tsx` following the Input pattern exactly: `React.forwardRef`, `cn()`, `Textarea.displayName`. Key differences from Input: `<textarea>` element, no `type` prop, no `h-10` fixed height, no `file:*` classes, added `resize-none`.

Added `notes.*` i18n block to both `en/issues.json` and `fr/issues.json` with 6 keys: `sectionLabel`, `placeholder`, `postButton`, `sentButton`, `postSuccess`, `postError`.

### Task 2: IssueDetailPanel note section + mock route

Four targeted changes to `IssueDetailPanel.tsx`:
- Added `useState` to React import
- Added `import { Textarea } from './ui/textarea'`
- Extended `useToast()` destructure to include `success: toastSuccess`
- Added `noteText`/`sent` state + `noteMutation` after `triageMutation`

`noteMutation` POSTs to `/github/repos/${owner}/${repo}/issues/${number}/comment` via `authenticatedFetch`. `onSuccess`: clears textarea, sets `sent=true`, calls `toastSuccess`, resets sent after 2s. `onError`: preserves textarea text, calls `toastError` (D-05).

Note section JSX inserted between triage controls divider and meta section: label, Textarea with `id="note-textarea"`, Ctrl+Enter keyboard shortcut, Post Note button (disabled when empty, shows Sent+CheckCircle2 when sent=true).

Added `upsertTriageRecord` to triage import in `github-fixtures.ts` and registered `POST /api/github/repos/:owner/:repo/issues/:number/comment` mock route that saves `githubCommentId`/`commentStatus` to dev.db.

Updated `IssueDetailPanel.test.tsx` to replace 7 RED-phase stubs with real GREEN assertions.

## Verification Results

```
IssueDetailPanel.test.tsx: 20 passed (13 existing TRIAGE + 7 new NOTES) — all GREEN
Full suite: 113 passing, 11 failing (all failures are pre-existing RED stubs from 06-01/06-02 backend — out of scope)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mockReturnValueOnce chain breaks on component re-render**

- **Found during:** Task 2 test GREEN phase
- **Issue:** `useMutation` is called twice per render (triageMutation + noteMutation). After `fireEvent.change` triggers re-render, `mockReturnValueOnce` chain was exhausted — third/fourth calls returned `undefined`, causing `noteMutate` to never be called and "Sent" button state tests to fail.
- **Fix:** Replaced `mockReturnValueOnce` chain with `mockImplementation` using an odd/even call counter. Odd-numbered calls return `triageMutate`, even-numbered return `noteMutate`. Also captured `noteMutation` options in a module-level `noteMutationOptionsRef` during the implementation callback. Used `act()` for callback invocations that trigger React state updates.
- **Files modified:** `IssueDetailPanel.test.tsx`
- **Commit:** 5347d4f7

## Known Stubs

None — all 7 NOTES stubs replaced with real assertions. No placeholder data wired to UI.

## Threat Flags

No new security-relevant surface beyond what was planned. The Textarea accepts user input but POST body is validated server-side by `githubCommentSchema` (plan 06-02). Client-side: button disabled when `noteText.trim() === ''` (T-06-07 D-06 mitigated).

## Self-Check: PASSED

- `apps/web/src/client/components/ui/textarea.tsx` — FOUND
- `apps/web/src/shared/i18n/locales/en/issues.json` — FOUND (contains "notes")
- `apps/web/src/shared/i18n/locales/fr/issues.json` — FOUND (contains "notes")
- `apps/web/src/client/components/IssueDetailPanel.tsx` — FOUND (contains noteMutation x6, note-textarea x2)
- `apps/web/scripts/mocks/github-fixtures.ts` — FOUND (contains upsertTriageRecord x2)
- Commit 09b52c5c — FOUND
- Commit 5347d4f7 — FOUND
