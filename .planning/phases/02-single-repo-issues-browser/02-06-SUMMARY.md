---
phase: 02-single-repo-issues-browser
plan: "06"
subsystem: frontend-components
tags: [react, markdown, i18n, issues-browser, detail-panel]
dependency_graph:
  requires: [02-04, 02-05]
  provides: [IssueDetailPanel]
  affects: [IssuesView]
tech_stack:
  added: [react-markdown@10, remark-gfm@4]
  patterns: [CSS-transform-slide-in, ReactMarkdown-wrapper-div, prose-typography]
key_files:
  created:
    - apps/web/src/client/components/IssueDetailPanel.tsx
  modified:
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
decisions:
  - "react-markdown v10 removed className prop from component — wrap in div for prose classes"
  - "IssueDetailPanel uses isOpen && issue guard so panel never shows stale content"
metrics:
  duration: ~10min
  completed: 2026-04-21T11:39:04Z
  tasks_completed: 1
  files_created: 1
  files_modified: 2
---

# Phase 02 Plan 06: IssueDetailPanel — Summary

**One-liner:** Slide-in issue detail panel with react-markdown + remark-gfm body rendering, full-color label badges, assignee avatars, and View on GitHub link.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create IssueDetailPanel component + i18n keys | b79d404f | IssueDetailPanel.tsx, en/issues.json, fr/issues.json |

## What Was Built

`IssueDetailPanel` is a `position: fixed` right-side panel that slides in via CSS transform (`translate-x-full` → `translate-x-0`) when `isOpen && issue` is true. It renders:

- State badge (`success` for open, `muted` for closed) + issue number + title
- Full-color label badges with `#${label.color}20` background, `#${label.color}60` border, `#${label.color}` text (all three color properties include the `#` prefix)
- Assignee avatars (img if `avatarUrl` exists, else 2-char initials) + login names
- Formatted created date via `toLocaleDateString`
- "View on GitHub" button using `issue.htmlUrl` with `target="_blank" rel="noreferrer"`
- Issue body rendered via `<ReactMarkdown remarkPlugins={[remarkGfm]}>` wrapped in a `div.prose.prose-sm.dark:prose-invert.max-w-none` — no `dangerouslySetInnerHTML`
- Fallback `detail.noBody` i18n key when `issue.body` is null

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-markdown v10 dropped className prop**
- **Found during:** Task 1 (typecheck)
- **Issue:** `react-markdown@10.1.0` removed the `className` prop from the `<ReactMarkdown>` component. The plan's code snippet passed `className="prose prose-sm dark:prose-invert max-w-none"` directly on the component, which caused TS2322 type error.
- **Fix:** Wrapped `<ReactMarkdown>` in a `<div className="prose prose-sm dark:prose-invert max-w-none">` container instead. This is the correct v10 pattern.
- **Files modified:** `apps/web/src/client/components/IssueDetailPanel.tsx`
- **Commit:** b79d404f

## Known Stubs

None — panel renders real data from the `GitHubIssue` prop passed by the parent.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model. The panel is a pure display component receiving data via props — no new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- [x] `apps/web/src/client/components/IssueDetailPanel.tsx` — exists
- [x] `export function IssueDetailPanel` — found
- [x] `import ReactMarkdown from 'react-markdown'` — found
- [x] `import remarkGfm from 'remark-gfm'` (default import) — found
- [x] `issue.htmlUrl` — found
- [x] `rel="noreferrer"` — found
- [x] `target="_blank"` — found
- [x] `translate-x-full` — found
- [x] `dangerouslySetInnerHTML` — NOT found (correct)
- [x] `#${label.color}` — found 3 times (bg, border, color)
- [x] `detail.noBody` in en/issues.json — found
- [x] `detail.noBody` in fr/issues.json — found
- [x] TypeCheck: no new errors (pre-existing `labels.test.ts` error unchanged)
- [x] Tests: 21/21 passed
- [x] Commit b79d404f — exists
