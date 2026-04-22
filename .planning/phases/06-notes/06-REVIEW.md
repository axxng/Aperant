---
phase: 06-notes
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/web/api/_lib/db/triage.test.ts
  - apps/web/api/_lib/db/triage.ts
  - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts
  - apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts
  - apps/web/scripts/mocks/github-fixtures.ts
  - apps/web/src/client/components/IssueDetailPanel.test.tsx
  - apps/web/src/client/components/IssueDetailPanel.tsx
  - apps/web/src/client/components/ui/textarea.tsx
  - apps/web/src/shared/i18n/locales/en/issues.json
  - apps/web/src/shared/i18n/locales/fr/issues.json
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase introduces the notes feature: a `POST /comment` API handler that posts a GitHub comment using a per-user OAuth token, an idempotency guard persisted in `issue_triage`, and a note textarea in `IssueDetailPanel`. The overall architecture is solid — the 4-step handler shape is followed, parse-don't-validate is applied to input, and the test coverage is thorough. Four issues warrant attention before ship.

The most actionable findings are: (1) the idempotency check does not exclude `commentStatus: 'failed'` records, which can cause a previously-failed post to appear as already-posted; (2) the raw GitHub API response is forwarded to the client without schema validation; (3) a shared mutable counter in the test mock breaks test isolation in the NOTES suite; and (4) `repoFullName` splitting in `IssueDetailPanel` silently produces wrong `owner`/`repo` values for repos with more than one slash.

---

## Warnings

### WR-01: Idempotency check returns `alreadyPosted: true` even when prior post failed

**File:** `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts:40`

**Issue:** The guard checks only for the presence of `githubCommentId`, not for `commentStatus`. If a previous attempt called `upsertTriageRecord` with `githubCommentId` and then the GitHub API returned a non-2xx status before line 69, the record would have no comment saved — but if any code path sets `githubCommentId` before the failure, the next request returns `{ alreadyPosted: true }` incorrectly. More practically: a `commentStatus: 'failed'` variant exists in the type but is never set by this handler, meaning any future code that sets it (e.g., error recovery) would be silently bypassed by the idempotency check.

The check should require `commentStatus === 'posted'` to be considered already-posted:

```typescript
// current (line 40):
if (existing?.githubCommentId) {

// fix:
if (existing?.githubCommentId && existing.commentStatus === 'posted') {
```

---

### WR-02: GitHub API response forwarded to client without schema validation

**File:** `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts:63`

**Issue:** `response.json()` is assigned to `comment` and returned directly to the client without any Zod parse. Per the project's Parse-Don't-Validate principle: "External API responses (GitHub, OAuth) → `apiSchema.parse(await response.json())` (programmer/deployment bug → 500)". If GitHub changes the response shape, callers receive unexpected data silently, and any downstream consumer reading `comment.id` on line 66 could receive `undefined`.

```typescript
// current:
const comment = await response.json();
await upsertTriageRecord(... { githubCommentId: comment.id, ... });

// fix — add to api/_lib/validation.ts and parse:
const comment = githubCommentResponseSchema.parse(await response.json());
// githubCommentResponseSchema = z.object({ id: z.number(), body: z.string(), html_url: z.string() })
```

If `comment.id` is `undefined` (schema mismatch), `upsertTriageRecord` receives `undefined` for `githubCommentId`, which is cast to `null` in the upsert, so the idempotency guard will never fire on retries — the comment gets duplicated on every retry.

---

### WR-03: Shared `callCount` in `setupNoteMocks` is not reset between tests, breaking isolation

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:259`

**Issue:** `callCount` is declared with `let callCount = 0` inside `setupNoteMocks` — but `setupNoteMocks` is called once per test, so `callCount` is correctly reset to `0` each time it is called. However, `useMutation.mockImplementation` captures the `callCount` variable in closure, and the mock implementation increments it on every call. If React calls `useMutation` more than twice during a single render (e.g., due to Strict Mode double-invoke in dev, or if any re-render triggers), the odd/even assignment drifts: the third call returns `triageMutate`, the fourth returns `noteMutate`, etc.

Since `callCount` resets per `setupNoteMocks` call, this is not cross-test contamination. The real risk is within a single test: any extra `useMutation` call (from React Strict Mode or a re-render triggered by `act()`) causes the second `useMutation` call to be assigned the triage mock instead of the note mock, making `noteMutate` assertions fail silently.

A more robust pattern captures mock assignment by inspecting the `mutationFn` argument instead of using a positional counter:

```typescript
vi.mocked(useMutation).mockImplementation((options: any) => {
  const isNoteMutation = options.mutationFn.toString().includes('/comment');
  return {
    mutate: isNoteMutation ? noteMutate : triageMutate,
    isPending: false,
  } as any;
});
```

Alternatively, assign a distinct `mutationKey` to each `useMutation` call in the component and match on that.

---

### WR-04: `repoFullName` split produces wrong `owner`/`repo` for non-standard repo names

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:47`

**Issue:** `(issue?.repoFullName ?? '/').split('/')` uses array destructuring to `[owner, repo]`. If `repoFullName` contains more than one slash (a GitHub org repo that includes a fork path, or a malformed value from mock data), `repo` silently captures only the second segment and the rest is dropped. If `repoFullName` is an empty string (not null), `split('/')` returns `['']`, so `owner = ''` and `repo = undefined`.

With `owner = ''` or `repo = undefined`, the `useQuery` `enabled` guard on line 62 (`Boolean(issue && owner && repo)`) correctly disables the query — but `triageMutation.mutate` on lines 211, 244, 256 still fires because they use the locally-destructured `owner`/`repo` directly, not re-checking validity. This would POST to `/triage//repo/42` or `/triage/org/undefined/42`.

```typescript
// current:
const [owner, repo] = (issue?.repoFullName ?? '/').split('/');

// fix — guard against malformed repoFullName:
const parts = issue?.repoFullName?.split('/') ?? [];
const owner = parts[0] ?? '';
const repo = parts[1] ?? '';
// owner/repo are already validated in mutate click handlers via `if (!issue) return;`
// but add a guard:
const repoValid = owner.length > 0 && repo != null && repo.length > 0;
// then: disabled={triageLoading || triageMutation.isPending || !repoValid}
```

---

## Info

### IN-01: Missing error tracking in `comment.ts` catch block

**File:** `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts:73`

**Issue:** The catch block swallows the error entirely — no logging, no Sentry capture. CLAUDE.md requires Sentry for error tracking in production; `console.log` is invisible in bundled apps. Unexpected errors in this handler (DB failures, JSON parse errors from `response.json()`) will surface as opaque 500s with no server-side trace.

```typescript
// fix — add Sentry or structured logging:
} catch (error: unknown) {
  // Sentry.captureException(error);
  res.status(500).json({ error: 'Internal server error' });
}
```

---

### IN-02: `setTimeout` in `noteMutation.onSuccess` has no cleanup on unmount

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:123`

**Issue:** `setTimeout(() => setSent(false), 2000)` is called without storing the timer ID or clearing it on component unmount. If the panel closes (unmounts) within 2 seconds of a successful note post, the callback fires on an unmounted component. React 18+ treats this as a no-op rather than throwing, but the timer is a memory leak if the panel is opened and closed rapidly. Use `useEffect` with a cleanup, or store the timer ID in a ref:

```typescript
const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

onSuccess: () => {
  setNoteText('');
  setSent(true);
  toastSuccess(t('notes.postSuccess'));
  if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
  sentTimerRef.current = setTimeout(() => setSent(false), 2000);
},
// In a useEffect cleanup:
useEffect(() => () => { if (sentTimerRef.current) clearTimeout(sentTimerRef.current); }, []);
```

---

### IN-03: Mock comment ID uses `Date.now()` which exceeds 32-bit integer range

**File:** `apps/web/scripts/mocks/github-fixtures.ts:195`

**Issue:** `const commentId = Date.now()` produces a 13-digit millisecond timestamp (~1.7 × 10¹²), which is larger than the maximum SQLite `INTEGER` (2⁶³ − 1 safely, but larger than what a DB column typed as `INT` can store if the schema uses 32-bit). GitHub comment IDs are typically 32-bit integers. This is mock-only code so it won't affect production, but if the dev DB schema defines `github_comment_id` as `INTEGER` with no explicit precision, SQLite stores it as a 64-bit signed integer and this is fine. Worth a comment for future maintainers explaining the deliberate use of epoch ms as a surrogate ID.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
