# Pitfalls Research — GitHub Issues Triage

**Domain:** GitHub API integration + triage workflow
**Researched:** 2026-04-21
**Overall confidence:** HIGH (primary GitHub docs) / MEDIUM (pattern-level claims verified against codebase)

---

## GitHub API Rate Limiting

### Primary Rate Limits

Authenticated requests are capped at **5,000 requests/hour** per token. With the current per-product token model, every product's token is a separate bucket — but the issues browser will make significantly more read requests than the existing sync cron, so the budget can erode quickly during active triage sessions.

**Points to watch:**
- Default page size for issues is 30; max `per_page` is 100. Fetching 10 repos at 100 issues each uses 10 requests immediately. Multiply by 3 concurrent users and you burn 30 requests in seconds.
- The cross-repo unified view (ISSUES-02) amplifies this: N repos = N requests per page load, no batching possible with REST.
- `x-ratelimit-remaining` drops to 0 silently — nothing stops the next API call from going out until the 403/429 lands.

**Detection headers:**

| Header | Meaning |
|--------|---------|
| `x-ratelimit-remaining` | Requests left in current window |
| `x-ratelimit-reset` | UTC epoch seconds when window resets |
| `x-ratelimit-used` | Requests consumed in window |
| `retry-after` | Seconds to wait (present on secondary limit hits) |

**Current codebase gap:** `githubFetch()` in `api/_lib/github.ts` makes raw `fetch()` calls with no rate-limit header inspection and no retry logic. Any 403/429 becomes a generic API error propagated to the client as a 500 or raw status pass-through. The issues browser will surface these as broken UI with no user guidance.

### Secondary Rate Limits

Secondary limits are **behavioural thresholds**, not a simple counter:
- More than 100 concurrent requests
- More than 900 points/minute on a single REST endpoint
- More than 80 content-generating requests/minute (POST/PATCH/PUT — comment posting and write-back)
- More than 90 seconds CPU time per 60-second real-time window

**Key distinction:** Secondary limits return **403** (not 429) with a body message containing "secondary rate limit". The `retry-after` header IS present on secondary limit responses. If you check only for `429` status codes you will miss secondary limit hits entirely.

**Current codebase gap:** The `syncAllProducts()` function in `github-sync.ts` runs all product syncs sequentially, but the new issues browser adds a user-interactive layer. If a user triggers "load all repos" at the same time the cron fires, the token can hit the secondary concurrent-request threshold.

### Backoff Strategy

GitHub's documented recommendation: wait at least 1 minute before retrying after a secondary limit, then use exponential backoff with jitter. For primary limits, wait until `x-ratelimit-reset`.

**What the current code does:** Zero backoff. One failure = one error response. The write-back retry loop in `retryPendingWritebacks()` increments a counter and re-runs on the next cron tick (which is fine for async write-backs), but interactive API calls in the new browser have no mitigation.

---

## Pagination Edge Cases

### Page-Based Pagination and Sort Instability

The issues endpoint uses page-based pagination (`?page=N&per_page=100`). When `sort=updated&direction=desc` is used (which is the current pattern in both the proxy and the sync cron), **new activity on any issue changes its sort position** between page fetches.

Concrete failure scenario: User is on page 2 of a busy repo. Between page 1 and page 2 requests, 5 issues are updated. Those 5 issues move to page 1. Everything on page 1 shifts down. The user on page 2 sees duplicates from page 1's tail and misses 5 issues entirely.

For **read-only browsing** this causes confusing duplicates/gaps in the list. For the **background sync** it is acceptable (issues will be caught on the next sync pass) but for interactive browsing it will feel broken.

### Link Header Omission

When all issues fit on a single page, GitHub **omits the `Link` header entirely** rather than returning an empty or self-referential link. The current proxy (`issues.ts`) correctly checks `linkHeader.includes('rel="next"')` and treats a missing header as `hasMore: false` — this is correct. Preserve this behaviour in any unified view implementation.

### Empty Results vs. 204 No Content

GitHub may return `204 No Content` instead of an empty array `[]` for some paginated endpoints when there is no data. Any consumer that calls `.json()` unconditionally on a 204 response will throw a parse error. This should be handled explicitly.

### Last Page URL Not Always Calculable

GitHub's `rel="last"` link is absent if the total count cannot be determined (large repos with many closed issues). Do not rely on `rel="last"` to show "X of Y pages" UI — compute from item count or hide the total.

### per_page Maximum

Maximum is **100** per request. Requesting `per_page=101` or higher is silently clamped to 100 — the response returns 100 items without error, but your count logic will be off if you expected 101. Always use 100 as the ceiling, never higher.

---

## Stale Data & Consistency

### Issues Mutated During a Triage Session

The issues browser will display a snapshot of GitHub state at load time. A user could triage an issue (mark priority, write a note) that was **closed or reassigned on GitHub** 2 minutes before they hit "Post Note". The comment will post successfully to a closed issue, which is valid GitHub API behaviour, but the triage record in Turso will reference a closed issue that the user never saw as closed.

**No webhook support** is available in this architecture (Vercel serverless, no persistent listener). The cron sync runs at a fixed interval. The gap between cron ticks is the window for stale data.

### Closed Issue with Live Triage Record

If a promoted issue-to-task link exists and the GitHub issue is closed externally:
1. The next cron sync will detect `state: closed` and set the task status to `done` (current behaviour in `github-sync.ts` line 73: `issue.state === 'closed' ? 'done' : existingTask.status`).
2. If the task has `githubSyncPending = true`, the sync is **skipped entirely** (line 68-70) — this is correct for write-back protection, but means a manually-closed GitHub issue will not propagate `done` status to a task that has a pending write-back.

**Gap for triage records:** The new triage state table (priority, triaged_at, internal notes) is not part of the existing task model. If an issue is promoted to a task and then the GitHub issue is closed externally, the triage record must also reconcile — either archive it or surface a "this issue was closed" warning.

### ETag / 304 Caching in the Sync

The cron sync (`github-sync.ts`) stores and sends `If-None-Match: <etag>` to avoid redundant data. This is good for the background sync. For the interactive browser, ETags should NOT be applied per-session because the user always wants fresh data — do not reuse the cron's ETags for browser requests.

---

## Write-Back Sync Conflicts

### The Core Divergence Scenario

Current write-back flow: task edit → `githubSyncPending = true` → cron fires → `syncTaskToGitHub()` → GitHub PATCH.

Issue-to-task promotion adds a new entry point: a task is created from an issue, then the user edits the task (title, body, status). Meanwhile on GitHub, the original issue author edits the issue body. The next cron sync runs `syncTaskToGitHub()` which overwrites GitHub with the Currents version. GitHub's version is lost silently.

**This is a last-write-wins race**, and the current codebase has no conflict detection. The `githubSyncPending` guard in the sync cron prevents GitHub-to-Turso overwrites but does not prevent Turso-to-GitHub overwrites of concurrent GitHub changes.

### Missing Conditional PUT / ETag on Write-Back

GitHub's REST API does not support conditional updates (If-Match ETag) on issue PATCH endpoints. There is no standard way to do an optimistic-lock write. The only mitigation is timestamp comparison: fetch the issue `updated_at` before patching, compare to the `updated_at` stored when the task was last synced, and abort if GitHub is newer.

**Current codebase gap:** `syncTaskToGitHub()` does a bare PATCH with no pre-fetch. This will silently overwrite external GitHub edits.

### Promoted Task → Issue Number Integrity

When an issue is promoted to a task, the `githubRepo` + `githubIssueNumber` pair is the link. If the GitHub issue is **transferred to a different repo**, its number may change. The REST API returns a 301 redirect for moved issues — `fetch()` follows redirects by default, so the PATCH will succeed but the stored `githubRepo`/`githubIssueNumber` in Turso will be stale, breaking future fetches.

### Write-Back Retry Cap

`MAX_SYNC_RETRIES = 10` in `github-writeback.ts` prevents infinite retry loops. After 10 failures, the task is silently skipped with `skipped++`. There is no user-facing notification that a write-back has been permanently abandoned. For the new issues browser, a triage note posted as a GitHub comment is fire-and-forget in this same pattern — if the comment fails 10 times, it is silently dropped.

---

## Cross-Repo N+1

### The Unified View Request Amplification Problem

ISSUES-02 requires "all issues from every connected product's repo in a single unified cross-repo list". With REST, this is **unavoidably one request per repo**. For a team with 8 products, loading page 1 of the unified view costs 8 API requests. Loading page 2 costs another 8.

The current GitHub proxy (`issues.ts`) is designed for single-repo calls. Naively wiring the unified view as a frontend loop over `GET /github/repos/{owner}/{repo}/issues` for each product sends 8 parallel requests from the browser through to GitHub. Each arrives as a separate authenticated call against the same token bucket.

**Amplification factor with the current architecture:** N products × M pages = N×M requests. For 8 products browsing 3 pages deep: 24 GitHub requests per user session.

### Sequential vs. Parallel — Choosing the Right Tradeoff

Running repos sequentially avoids secondary rate-limit triggers but makes the unified view slow (8 sequential fetches). Running them in parallel is fast but risks hitting the 100-concurrent-request secondary limit if many users are active simultaneously.

**Recommended middle ground:** Fan out in batches of 3–5 repos concurrently, with a brief gap between batches. `Promise.allSettled()` for graceful partial failures.

### GraphQL as the Partial Solution

GitHub's GraphQL API supports fetching issues from multiple repos in a **single query** using aliased fields or the search endpoint (`search { nodes { ... on Issue {} } }`). The `search` query with `is:issue repo:owner/repo1 repo:owner/repo2` syntax can retrieve issues across repos in one round-trip.

**GraphQL is appropriate when:** Cross-repo unified view needs to avoid N API calls. GraphQL secondary rate limits are per-point (2,000 points/minute), and a complex multi-repo query counts more points than a simple query — but still far fewer than N separate REST calls.

**GraphQL is NOT necessary for:** Single-repo browsing, comment posting, or promoting issues to tasks — REST is simpler and perfectly adequate for those.

**Caution:** The existing `githubGraphQL()` helper in `github.ts` throws on `data.errors` but does not handle partial errors (GraphQL can return `data` AND `errors` simultaneously when some aliased fields succeed and others fail). The unified view query must check both.

---

## Comment Posting Failures

### Non-Idempotent POST

Posting a GitHub comment is a `POST /repos/{owner}/{repo}/issues/{number}/comments`. HTTP POST is not idempotent — if the request succeeds on GitHub but the response times out before reaching the Vercel function, a naïve retry creates a **duplicate comment**. The user sees their note posted twice on the GitHub issue.

GitHub does not provide an idempotency key mechanism for issue comments (unlike Stripe's `Idempotency-Key` header pattern).

**Mitigation:** Store a `commentPendingId` (UUID) in the Turso triage record before attempting the POST. On success, store the returned GitHub comment ID. On retry, check if a `githubCommentId` already exists for that triage note — if yes, skip the POST. This requires a schema column for the triage table.

### No Transactional Guarantee Between DB and GitHub

The desired sequence for "post note" is:
1. Write triage record to Turso
2. POST comment to GitHub
3. Update triage record with `githubCommentId`

If step 2 fails, Turso has an orphaned triage record with no GitHub comment. If step 3 fails, the comment exists on GitHub but is unlinked in Turso. Neither failure is surfaced to the user by the current error-passing pattern (bare `response.status` pass-through in `comment.ts`).

**For graceful degradation:** Treat step 2 failure as retryable (same `githubSyncPending` pattern as write-backs). Treat step 3 failure as reconcilable on next load (fetch comment ID from GitHub by matching body text if needed). Do NOT make the UI block on step 3.

### Posting to a Closed Issue

GitHub allows comments on closed issues — no API error is returned. But users may be confused to see their "triage note" was posted to an issue that was already closed when they triaged it. The UI should warn if `issue.state === 'closed'` before posting.

### Token Scope Requirements

Posting a comment requires the token to have `repo` scope (or `public_repo` for public repos). The current token model stores a user-supplied token. If the user provides a read-only token (e.g. `read:org` only), comment posts will fail with 403. This is indistinguishable from a rate-limit 403 without parsing the response body.

---

## Phase Mapping

| Pitfall | Phase to Address |
|---------|-----------------|
| No rate-limit detection in `githubFetch()` | Phase 1 (before any new GitHub calls ship) |
| Primary/secondary limit distinction (403 vs 429) | Phase 1 |
| `per_page` max + Link header parsing | Phase 1 (issues browser core) |
| Page-sort instability for interactive browsing | Phase 1 (document limitation; cursor pagination deferred) |
| Cross-repo N+1 on unified view | Phase 2 (ISSUES-02 unified view) |
| GraphQL multi-repo batching | Phase 2 |
| Stale issue state during triage session | Phase 2–3 (surfacing stale state in UI) |
| Closed-issue triage record inconsistency | Phase 3 (triage schema + state machine) |
| Comment posting duplicate on retry | Phase 4 (ISSUES-04 note posting) |
| No transactional guarantee DB ↔ GitHub for comments | Phase 4 |
| Write-back conflict (concurrent GitHub edit) | Phase 5 (ISSUES-05 promote + write-back) |
| Promoted task ↔ transferred issue 301 redirect | Phase 5 |
| Abandoned write-back with no user notification | Phase 5 |
| Token scope check before comment post | Phase 4 |

---

## Prevention Strategies

### 1. Add Rate-Limit-Aware Wrapper to `githubFetch()`

**Action:** Extend `githubFetch()` to inspect response headers on every call. If `x-ratelimit-remaining` is 0, extract `x-ratelimit-reset`, compute wait time, and either return a structured error `{ rateLimited: true, retryAfter: N }` or throw a typed `GitHubRateLimitError`. Do NOT silently pass the 403 through.

**Distinguish primary vs secondary:** Check if response is 403 AND body contains "secondary rate limit" → `GitHubSecondaryRateLimitError`. Check if `x-ratelimit-remaining === '0'` → `GitHubPrimaryRateLimitError`. Both should surface as actionable UI messages ("GitHub rate limit reached — try again in N minutes") not generic 500s.

```typescript
// Pseudocode for the wrapper
if (!response.ok) {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const retryAfter = response.headers.get('retry-after');
  const resetAt = response.headers.get('x-ratelimit-reset');
  const body = await response.text();
  
  if (response.status === 403 && body.includes('secondary rate limit')) {
    throw new GitHubSecondaryRateLimitError(Number(retryAfter) || 60);
  }
  if (remaining === '0') {
    throw new GitHubPrimaryRateLimitError(Number(resetAt));
  }
  // other errors...
}
```

### 2. Batch Cross-Repo Requests (Don't Fan Out N-at-Once)

**Action:** The unified view server-side handler should fan out repo requests in batches of 3–5 with `Promise.allSettled()`. Return partial results if some repos fail (repo-level errors in the response payload, not a global 500). The frontend handles `{ issues: [...], errors: [{ repo, message }] }`.

```typescript
// Pseudocode for batched fan-out
const BATCH_SIZE = 4;
const batches = chunk(repos, BATCH_SIZE);
const results = [];
for (const batch of batches) {
  const batchResults = await Promise.allSettled(
    batch.map(repo => fetchIssuesForRepo(repo))
  );
  results.push(...batchResults);
  // Small delay between batches if secondary limit is a concern
}
```

### 3. Idempotent Comment Posting

**Action:** Before posting a comment, insert a triage record row with `status: 'pending_comment'` and a generated `pendingCommentId`. After successful POST, update with `status: 'posted'` and `githubCommentId`. On retry (e.g., if the route is called again due to UI retry), check if `githubCommentId` is already populated — if yes, return success immediately without re-posting.

**Schema implication:** The new `issue_triages` table needs columns: `github_comment_id TEXT`, `comment_status TEXT` (pending/posted/failed).

### 4. Stale Issue Warning in the Triage UI

**Action:** Store `issueFetchedAt` timestamp client-side when an issue is loaded. If the user opens the triage panel more than N minutes after `issueFetchedAt` (or if the cron sync has run since load), show a "This issue may have changed on GitHub — refresh to see latest" banner. A simple `updatedAt` comparison between the cached issue and the next poll response is sufficient.

### 5. Pre-Fetch `updated_at` Before Write-Back PATCH

**Action:** For issue-to-task write-backs, store `githubIssueUpdatedAt` in the task row when the issue is promoted. Before each PATCH in `syncTaskToGitHub()`, do a lightweight GET on the issue and compare `updated_at`. If GitHub's `updated_at` is newer than `githubIssueUpdatedAt`, the issue was modified externally — log the conflict, skip the PATCH, set `githubSyncPending = false` (give up on this sync cycle), and surface a "sync conflict" flag in the UI.

**Cost:** 1 extra GET per write-back attempt. With `MAX_SYNC_RETRIES = 10` cap this is bounded.

### 6. Handle GraphQL Partial Errors

**Action:** Modify `githubGraphQL()` to detect `data !== null && errors !== undefined` (partial success case) and either surface per-field errors or fall back to REST for the failed aliases. The current implementation throws on any `errors` presence, which rejects the entire response even if 7 of 8 repos succeeded.

```typescript
// Current (throws on any error):
if (data.errors) throw new Error(...);

// Better:
if (data.errors && !data.data) throw new Error(...);  // total failure
if (data.errors && data.data) return { data: data.data, partialErrors: data.errors };
```

### 7. Graceful Degradation on Closed/Transferred Issues

**Action:** When promoting an issue to a task, store the issue's current `state` and `updated_at` in the task metadata. In the issues browser, if a user tries to triage or post a note to an issue the UI already shows as `state: open`, but the POST returns 404 (transferred) or the issue re-fetch shows `state: closed`, surface a specific message: "This issue has been closed/moved on GitHub. Triage note was not posted."

### 8. Surface Abandoned Write-Backs

**Action:** Extend the task type or add a separate notification to flag tasks where `githubSyncRetryCount >= MAX_SYNC_RETRIES && githubSyncPending = true`. Display a warning badge in the UI: "GitHub sync permanently failed — edit history may not be reflected on GitHub." This prevents silent data divergence going unnoticed.

---

## Sources

- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — HIGH confidence
- [GitHub REST API Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api) — HIGH confidence
- [Comparing GitHub REST vs GraphQL](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api) — HIGH confidence
- [GitHub Issues & Projects: Advanced Search API 2025](https://github.blog/changelog/2025-03-06-github-issues-projects-api-support-for-issues-advanced-search-and-more/) — MEDIUM confidence
- [Secondary rate limit discussion](https://github.com/changesets/action/issues/192) — MEDIUM confidence (community verification)
- Codebase analysis of `github.ts`, `github-sync.ts`, `github-writeback.ts`, `issues.ts`, `comment.ts` — HIGH confidence (direct inspection)
