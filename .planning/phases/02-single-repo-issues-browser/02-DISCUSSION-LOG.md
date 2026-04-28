# Phase 2: Single-Repo Issues Browser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 02-single-repo-issues-browser
**Areas discussed:** Navigation entry point, Issue list layout, Detail panel style, Default sort order, Label filter loading, Search behaviour, Markdown rendering, Empty & loading states

---

## Navigation entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Tab switcher inside product view | Kanban / Issues tabs at top of content area. No sidebar changes. Routes: /products/:productId and /products/:productId/issues | ✓ |
| Sub-link in sidebar per product | Expand each product item to show Kanban and Issues links | |
| Issues icon in sidebar (top-level) | Standalone Issues entry above/below product list | |

**User's choice:** Tab switcher inside product view
**Notes:** Keeps sidebar clean; no sidebar changes required.

---

## Issue list layout

| Option | Description | Selected |
|--------|-------------|----------|
| Dense list rows | Horizontal row: issue number + title + label dots + assignee avatar + state badge | ✓ |
| Cards (same as TaskCard) | Card component with full label names, assignee, relative time | |
| Cards with adjustable density | Default compact; toggle to full cards | |

**User's choice:** Dense list rows
**Notes:** Maximises issues visible per screen; GitHub-native feel.

---

## Detail panel style

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-in right panel | ~40% viewport width; list stays visible on the left | ✓ |
| Modal dialog | Full-focus modal; reuses existing Dialog component | |
| Full-page detail route | Navigate to /products/:productId/issues/:issueNumber | |

**User's choice:** Slide-in right panel
**Notes:** Users can click other issues without closing the panel; list maintains context.

---

## Default sort order

| Option | Description | Selected |
|--------|-------------|----------|
| sort=updated — most recently active first | GitHub's own default; best for monitoring active discussions | ✓ |
| sort=created — newest by creation date | Stable ordering; better for new-issue triage workflows | |

**User's choice:** sort=updated, direction=desc
**Notes:** Resolves the open question flagged in STATE.md.

---

## Label filter loading

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch repo labels on page load | Parallel fetch with first issues page; dropdown ready immediately | ✓ |
| Fetch lazily when filter is opened | Labels API only called when user clicks filter button | |
| Derive labels from loaded issues only | No extra API call; misses labels on unloaded pages | |

**User's choice:** Fetch repo labels on page load
**Notes:** On fetch failure, show error in dropdown but issues still load normally.

---

## Search behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side title filter | Filter loaded issues by title match in browser; instant, no API calls | ✓ |
| Server-side via GitHub Search API | /search/issues?q=; searches body+comments; different rate limit bucket | |
| Server-side via issues proxy with title param | GitHub issues endpoint doesn't natively support title search | |

**User's choice:** Client-side title filter
**Notes:** Aligns with BROWSE-05 (search by title). Only matches currently-loaded issues — acceptable tradeoff.

---

## Markdown rendering

| Option | Description | Selected |
|--------|-------------|----------|
| react-markdown + remark-gfm | GitHub Flavored Markdown; task lists, tables, strikethrough; safe | ✓ |
| marked + dangerouslySetInnerHTML | Faster/smaller but requires DOMPurify sanitization for XSS safety | |
| Claude decides | Let Claude pick based on codebase | |

**User's choice:** react-markdown + remark-gfm
**Notes:** ~15KB gzipped; well-maintained; no XSS risk without dangerouslySetInnerHTML.

---

## Empty & loading states

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton rows + branded empty state | 8 animated skeleton rows; branded empty state with GitHub icon + link | ✓ |
| Spinner + plain empty message | Centered spinner; simple text for empty | |
| Claude decides | Most consistent with existing codebase patterns | |

**User's choice:** Skeleton rows + branded empty state
**Notes:** Skeleton rows match list row height (animate-pulse); empty state links to github.com issues.

---

## Claude's Discretion

- Exact skeleton markup and animation style
- Whether tab switcher uses Radix Tabs or NavLink pair
- TanStack Query cache settings (stale time, GC)
- Slide-in panel implementation (CSS transform, Radix Sheet, or custom div)

## Deferred Ideas

- Body + comment search via GitHub Search API — rate-limit complexity not justified
- Assignee filter from repo collaborators list — deriving from loaded issues is sufficient
- Sort order user toggle UI control — default covers common case
