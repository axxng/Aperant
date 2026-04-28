---
phase: 02-single-repo-issues-browser
verified: 2026-04-21T12:10:00Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full end-to-end browser UI verification"
    expected: "15 UI checks from plan 02-07 Task 2 checkpoint all pass: tab active state, filter bar renders, issues load, skeleton flashes, search filters, labels dropdown, URL state, detail panel slides in, Markdown renders, Load More works, View on GitHub opens correct URL, Kanban tab navigates back"
    why_human: "CSS transform slide-in animation, NavLink active underline, Markdown rendering quality, real GitHub API data, pagination feel, and overall user flow cannot be verified programmatically without a running browser"
---

# Phase 2: Single-Repo Issues Browser Verification Report

**Phase Goal:** Single-Repo Issues Browser — users can browse, filter, and inspect GitHub issues for a connected repository from within the app.
**Verified:** 2026-04-21T12:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/github/repos/:owner/:repo/labels returns {labels:[{id,name,color,description}]}, enforces auth/method/rate-limit | VERIFIED | `labels.ts` exists with `authenticateRequest`, `githubOwnerRepoSchema`, `GitHubRateLimitError` catch, `encodeURIComponent` on both params, `per_page=100` |
| 2 | App.tsx wraps AuthenticatedApp subtree with QueryClientProvider; queryClient declared at module scope | VERIFIED | `grep` confirms `const queryClient = new QueryClient(` at module scope; `<QueryClientProvider client={queryClient}>` wraps the return |
| 3 | Route /products/:productId/issues exists pointing to IssuesView | VERIFIED | `path="/products/:productId/issues"` with `element={<IssuesView />}` confirmed in `App.tsx` line 90-91 |
| 4 | en/issues.json and fr/issues.json exist with all required i18n keys | VERIFIED | Both files are valid JSON; all keys present: tab, filters, list, empty, error (with rateLimit nesting), detail (with noBody), state |
| 5 | useIssuesFilters reads state/labels/assignee from URL search params; search is local useState; always uses functional updater | VERIFIED | `useSearchParams`, `getAll('label')`, `useState('')` for search, `setSearchParams(prev =>` functional updater on both setFilters and resetFilters |
| 6 | IssueListRow renders h-11 dense row with label color dots (#prefix), assignee avatars, state badge; wrapped in memo() | VERIFIED | `memo`, `GitHubIssue` type, `h-11`, `backgroundColor: \`#${label.color}\``, `variant="success"/"muted"` all confirmed |
| 7 | IssueSkeletonRow renders animate-pulse placeholder row at h-11 height; wrapped in memo() | VERIFIED | `memo`, `h-11`, `animate-pulse` all confirmed |
| 8 | IssuesFilterBar renders search, state toggle, label multi-select (with onSelect preventDefault), assignee single-select, conditional reset with aria-label; memo() wraps | VERIFIED | `memo`, `onSelect={e => e.preventDefault()}`, `aria-label`, `error.labelsFetch`, `allAssignees`, `#${label.color}` all confirmed |
| 9 | IssueDetailPanel slides in via CSS transform; body rendered with react-markdown + remark-gfm; htmlUrl used for View on GitHub; no dangerouslySetInnerHTML | VERIFIED | `translate-x-full`, `ReactMarkdown`, `import remarkGfm from 'remark-gfm'` (default import), `issue.htmlUrl`, `rel="noreferrer"`, no `dangerouslySetInnerHTML` |
| 10 | IssuesView assembles all components: useInfiniteQuery + useQuery, 8 skeletons, Load More, empty/error states, client-side search, selectedIssueId panel control | VERIFIED | All wiring confirmed: `useInfiniteQuery`, `useQuery`, `Array.from({length: 8})`, `fetchNextPage`, `hasNextPage`, `filteredIssues`, `selectedIssueId`, `products.find`, `[...labels].sort()`, `credentials: 'include'`, `enabled: Boolean(repoSource)` |
| 11 | TypeScript typecheck passes with no new errors from Phase 2 changes | FAILED | `npm run typecheck` exits with code 2; TS2322 in `labels.test.ts:52` — return type mismatch in the fallback handler lambda. The error is in the Nyquist stub created in plan 02-01 (acknowledged as pre-existing in 02-07 SUMMARY but never fixed) |

**Score:** 10/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/package.json` | @tanstack/react-query, react-markdown, remark-gfm, @tailwindcss/typography in dependencies | VERIFIED | All 4 packages confirmed in `dependencies` |
| `apps/web/src/client/styles/globals.css` | `@plugin "@tailwindcss/typography"` directive | VERIFIED | Line 2: `@plugin "@tailwindcss/typography"` |
| `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` | 7+ test cases for BROWSE-01..04, BROWSE-08 | VERIFIED | 7 `it(` calls confirmed |
| `apps/web/api/github/repos/[owner]/[repo]/labels.test.ts` | 4+ test cases for BROWSE-03 | VERIFIED | 4 `it(` calls confirmed |
| `apps/web/api/github/repos/[owner]/[repo]/labels.ts` | Authenticated labels proxy route | VERIFIED | Substantive — 55 lines, all key patterns present |
| `apps/web/src/client/App.tsx` | QueryClientProvider wrap + IssuesView route | VERIFIED | Both changes confirmed |
| `apps/web/src/shared/i18n/locales/en/issues.json` | All i18n keys from UI-SPEC | VERIFIED | All required keys including `detail.noBody` added in 02-06 |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | French translations matching en structure | VERIFIED | All keys present, identical top-level structure |
| `apps/web/src/client/hooks/useIssuesFilters.ts` | URL-synced filter hook | VERIFIED | Exports `useIssuesFilters`, `IssuesFilters`, `IssueState` |
| `apps/web/src/client/components/IssueListRow.tsx` | Dense list row component | VERIFIED | Substantive — memo-wrapped, uses GitHubIssue type, correct label color prefix |
| `apps/web/src/client/components/IssueSkeletonRow.tsx` | Loading skeleton row | VERIFIED | Substantive — memo-wrapped, animate-pulse, h-11 |
| `apps/web/src/client/components/IssuesFilterBar.tsx` | Filter bar with all controls | VERIFIED | Substantive — all controls present, memo-wrapped |
| `apps/web/src/client/components/IssueDetailPanel.tsx` | Slide-in detail panel | VERIFIED | Substantive — ReactMarkdown wired, htmlUrl used, no dangerouslySetInnerHTML |
| `apps/web/src/client/components/IssuesView.tsx` | Top-level route component (replaces stub) | VERIFIED | Full implementation — useInfiniteQuery, all sub-components assembled |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` | `@tanstack/react-query` | QueryClientProvider import | WIRED | Confirmed — QueryClient declared at module scope, QueryClientProvider wraps authenticated subtree |
| `App.tsx` | `IssuesView.tsx` | Route element prop | WIRED | `/products/:productId/issues` routes to `<IssuesView />` |
| `labels.ts` | `_lib/github.ts` | `githubFetch()` import | WIRED | `import { githubFetch, GITHUB_API, GitHubRateLimitError }` confirmed |
| `labels.ts` | `_lib/auth/middleware.ts` | `authenticateRequest` | WIRED | Import and call confirmed |
| `useIssuesFilters.ts` | `react-router-dom` | `useSearchParams` import | WIRED | Confirmed |
| `IssueListRow.tsx` | `@shared/types/github` | `GitHubIssue` type import | WIRED | Confirmed |
| `IssuesFilterBar.tsx` | `useIssuesFilters.ts` | `IssuesFilters` type import | WIRED | Confirmed |
| `IssueDetailPanel.tsx` | `react-markdown` | `ReactMarkdown` default import | WIRED | Confirmed |
| `IssueDetailPanel.tsx` | `remark-gfm` | `remarkGfm` default import | WIRED | Confirmed — correct default import (not named import) |
| `IssuesView.tsx` | `useIssuesFilters.ts` | `useIssuesFilters` import | WIRED | Confirmed |
| `IssuesView.tsx` | `/api/github/repos/:owner/:repo/issues` | `fetch` in `useInfiniteQuery` queryFn | WIRED | Confirmed — with `credentials: 'include'` |
| `IssuesView.tsx` | `/api/github/repos/:owner/:repo/labels` | `fetch` in `useQuery` queryFn | WIRED | Confirmed — with `credentials: 'include'`, staleTime 5min |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `IssuesView.tsx` | `allIssues` | `useInfiniteQuery` → `fetch /api/github/repos/…/issues` → `labels.ts` proxy → GitHub API | Yes — fetch chain hits real GitHub API via authenticated server-side proxy | FLOWING |
| `IssuesView.tsx` | `labelsData` | `useQuery` → `fetch /api/github/repos/…/labels` → `labels.ts` proxy → GitHub API | Yes — same authenticated proxy pattern | FLOWING |
| `IssuesView.tsx` | `filteredIssues` | `useMemo` over `allIssues` — real data, client-side search filter | Yes — filters real data, not hardcoded | FLOWING |
| `IssueDetailPanel.tsx` | `issue` prop | `selectedIssue = allIssues.find(i => i.id === selectedIssueId)` | Yes — derives from real loaded data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test suite passes | `cd apps/web && npm test` | 21 passed, 4 files, exit 0 | PASS |
| TypeScript typecheck | `cd apps/web && npm run typecheck` | TS2322 in `labels.test.ts:52` — exit 2 | FAIL |
| `labels.ts` exports default handler | File exists and exports `default async function handler` | Confirmed | PASS |
| en/issues.json valid JSON with required keys | `node -e "JSON.parse(…)"` | Valid — all keys confirmed | PASS |
| fr/issues.json valid JSON with required keys | `node -e "JSON.parse(…)"` | Valid — all keys confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| BROWSE-01 | 02-01, 02-03, 02-07 | User can view open GitHub issues for a connected product repo | SATISFIED | `IssuesView` defaults to `state=open`, fetches via `useInfiniteQuery` from `/api/github/repos/…/issues` |
| BROWSE-02 | 02-01, 02-03, 02-07 | User can view closed GitHub issues | SATISFIED | State toggle in `IssuesFilterBar` sets `state=closed`; `issues.ts` accepts `state` param and passes to GitHub API |
| BROWSE-03 | 02-01, 02-02, 02-03, 02-05, 02-07 | User can filter issues by one or more labels (multi-select) | SATISFIED | Labels API (`labels.ts`) returns all repo labels; `IssuesFilterBar` multi-select sends to `useIssuesFilters`; `IssuesView` passes `labels.join(',')` to issues API |
| BROWSE-04 | 02-01, 02-03, 02-04, 02-05, 02-07 | User can filter issues by assignee | SATISFIED | Assignee single-select in `IssuesFilterBar`; `useIssuesFilters` serializes to URL; `IssuesView` passes `assignee` param to fetch |
| BROWSE-05 | 02-03, 02-04, 02-07 | User can search issues by keyword in title | SATISFIED | `useIssuesFilters` exposes `search` (local useState); `IssuesView` applies `useMemo` filter on `allIssues` titles |
| BROWSE-06 | 02-03, 02-06, 02-07 | User can open detail panel with rendered Markdown body, labels, assignee, created date | SATISFIED | `IssueDetailPanel` slides in via CSS transform; `ReactMarkdown + remarkGfm` renders body; all metadata shown |
| BROWSE-07 | 02-03, 02-07 | User can load more issues via "Load More" button (50 per page) | SATISFIED | `useInfiniteQuery` with `per_page: 50`; `hasNextPage` controls button visibility; `fetchNextPage()` on click |
| BROWSE-08 | 02-01, 02-03, 02-06, 02-07 | User can navigate to original issue on github.com from detail panel | SATISFIED | `IssueDetailPanel` renders `<a href={issue.htmlUrl} target="_blank" rel="noreferrer">` with `ExternalLink` icon |

**Note on REQUIREMENTS.md:** The file shows BROWSE-05, BROWSE-06, BROWSE-07 as unchecked ([ ]). This is a documentation gap — the code fully implements all three. The checkboxes in REQUIREMENTS.md were not updated after implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `labels.test.ts` | 52 | TS2322 type error — fallback handler lambda `Promise<VercelResponse \| undefined>` not assignable to `Promise<void>` | Warning | TypeCheck fails; tests still pass. The stub was created in plan 02-01 for RED state; labels.ts was created in 02-02 making this stub unnecessary, but the type error was never fixed. Does NOT block runtime behavior. |

No stub implementations, no `console.log`, no `dangerouslySetInnerHTML`, no `getActiveProduct()` in IssuesView, no hardcoded empty data.

### Human Verification Required

#### 1. Full Issues Browser End-to-End UI Test

**Test:** Start the dev server (`cd apps/web && npm run dev`). Navigate to a product that has a connected GitHub repository. Click the "Issues" tab.

**Expected (15 checks from plan 02-07 Task 2):**
1. "Issues" tab becomes active with border-primary underline; "Kanban" tab is inactive
2. Filter bar shows: search input, Labels dropdown, Assignee dropdown, Open/Closed toggle
3. Issues load — list rows with issue number, title, label color dots, assignee avatars, state badge
4. Loading: navigate away and back — 8 skeleton rows should flash briefly before data loads
5. Keyword search: type in search box — list filters to matching titles instantly (no page reload)
6. Labels dropdown: opens showing color dots + label names; checking a label keeps dropdown open; issue list updates
7. URL state: after applying filters, copy URL and open in new tab — filters should be restored
8. Detail panel: click an issue row — panel slides in from right showing title, state badge, labels (full names with colors), assignee avatar + login, created date, Markdown body, "View on GitHub" button
9. Markdown rendering: issue bodies with bold, code blocks, or lists should be formatted (not raw)
10. Assignee filter: select an assignee from dropdown — list updates to show only that assignee's issues
11. State toggle: click "Closed" — list refreshes to show closed issues; click "Open" — returns to open
12. Load More: if repo has >50 issues, scroll to bottom — "Load More Issues" button visible; click it to append next 50
13. View on GitHub: click button in detail panel — opens correct github.com issue URL in new tab
14. Reset Filters: apply any filter, confirm "Reset Filters" button appears; click it — all filters clear
15. Kanban tab: click "Kanban" — navigates back to Kanban board view

**Why human:** CSS transform slide-in animation, NavLink active underline visual state, Markdown rendering quality, real GitHub API data loading, pagination feel, and overall user flow cannot be verified programmatically without a running browser.

---

## Gaps Summary

One automated check fails (TypeScript typecheck) and one blocking gate requires human sign-off.

**TypeScript TS2322 in `labels.test.ts:52`:** The fallback handler lambda in the Nyquist stub has a return type mismatch (`Promise<VercelResponse | undefined>` vs `Promise<void>`). The stub was created in plan 02-01 for the RED state before `labels.ts` existed. After plan 02-02 created `labels.ts`, the fallback is no longer exercised at runtime but the type error remains unfixed. Fix: change the `handler` variable type annotation to `(req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse | undefined>` or cast the fallback lambda.

**Human verification pending:** Plan 02-07 included a `type="checkpoint:human-verify" gate="blocking"` task (Task 2) requiring manual browser testing of 15 UI behaviors. The SUMMARY acknowledges this was not completed by the executor. This gate must be approved before the phase can be signed off.

---

_Verified: 2026-04-21T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
