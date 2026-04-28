---
phase: 07-to-use-github-oauth-login-to-use-the-given-repo-permissions-
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/web/api/tasks/by-github-issue.test.ts
  - apps/web/api/tasks/by-github-issue.ts
  - apps/web/api/tasks/index.test.ts
  - apps/web/api/tasks/index.ts
  - apps/web/src/client/components/AllIssuesView.tsx
  - apps/web/src/client/components/IssueDetailPanel.test.tsx
  - apps/web/src/client/components/IssueDetailPanel.tsx
  - apps/web/src/client/components/IssuesView.tsx
  - apps/web/src/shared/i18n/locales/en/issues.json
  - apps/web/src/shared/i18n/locales/fr/issues.json
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase adds a "Promote to Backlog" feature: a new `GET /api/tasks/by-github-issue` endpoint, a 409 duplicate guard on `POST /api/tasks`, and an `IssueDetailPanel` promote button with `useQuery`/`useMutation`. Overall the implementation is solid and follows the project's engineering principles — Parse-Don't-Validate, the 4-step handler shape, discriminated-union types, and i18n coverage. Three warnings and three info items require attention before the phase is considered clean.

---

## Warnings

### WR-01: Non-null assertions on optional schema fields bypass type safety in UNIQUE-conflict recovery

**File:** `apps/web/api/tasks/index.ts:53-54`

**Issue:** In the `catch` block that handles `UNIQUE constraint failed`, the code calls `getTaskByGitHubIssue` using `result.data.githubRepo!` and `result.data.githubIssueNumber!`. Both fields are declared `.optional()` in `createTaskSchema` (`api/_lib/validation.ts` lines 76-78). If a non-GitHub task create request happens to trigger a different UNIQUE constraint, `githubRepo` and `githubIssueNumber` will be `undefined` at runtime, the non-null assertions will pass TypeScript but the DB call will receive `undefined` arguments, causing an unhandled DB error to propagate instead of the intended 409.

**Fix:** Guard both fields before calling `getTaskByGitHubIssue`, and fall through to re-throw if they are absent:

```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (
    message.includes('UNIQUE constraint failed') &&
    result.data.githubRepo &&
    result.data.githubIssueNumber
  ) {
    const existing = await getTaskByGitHubIssue(
      result.data.githubRepo,
      result.data.githubIssueNumber
    );
    return res.status(409).json({
      error: 'This issue is already in the backlog.',
      existingTask: existing,
    });
  }
  throw err;
}
```

---

### WR-02: Authorization checked after input parsing on `GET /api/tasks/by-github-issue` — query params treated as programmer-level, but they originate from unauthenticated requests

**File:** `apps/web/api/tasks/by-github-issue.ts:14-26`

**Issue:** The handler parses `repo` and `number` from the query string using `z.parse()` (throwing ZodError → 500) before authenticating the user. Per the CLAUDE.md principle, `.parse()` (throw on failure) is reserved for DB rows and external API responses — programmer/deployment bugs — because a user-recoverable 400 is expected for user-submitted input. More critically, the order violates the project's 4-step shape: **parse → authorize → domain → respond**. Here step 1 (parse) happens before step 2 (authorize), which means an unauthenticated request with a malformed query param will receive a 500 error instead of a 401/403. The authentication check should come first so unauthenticated callers are rejected before any query parsing.

**Fix:** Move the authorization step before parsing, and switch to `safeParse` with a 400 response for query params (since they are user-submitted input via the browser URL):

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 2. Authorize first — unauthenticated requests must not reach parse or DB
  const user = await authenticateRequest(req, res);
  if (!user) return;
  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 1. Parse — query params are user-submitted; use safeParse + 400
  const repoResult = z
    .string()
    .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .safeParse(req.query.repo as string);
  const numberResult = z.coerce.number().int().positive().safeParse(req.query.number as string);
  if (!repoResult.success || !numberResult.success) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  const task = await getTaskByGitHubIssue(repoResult.data, numberResult.data);
  return res.json(task ?? null);
}
```

---

### WR-03: `by-github-issue` test does not cover missing/invalid query parameter cases

**File:** `apps/web/api/tasks/by-github-issue.test.ts:33-62`

**Issue:** The test suite covers the happy path, null result, 405, and 403 — but has no test for a missing `repo` param, a missing `number` param, or a malformed repo string (e.g. `"notaslug"`). Per the Red-Green TDD principle (CLAUDE.md §4), boundary failure cases must be tested. The current omission means the parse-error path (currently a 500 from ZodError) has no coverage and the fix in WR-02 will have no regression test.

**Fix:** Add tests for the invalid-input branches:

```typescript
it('returns 400 when repo query param is missing', async () => {
  const { res, status, json } = mockVercelRes();
  await handler(mockVercelReq({ query: { number: '42' } }), res);
  expect(status).toHaveBeenCalledWith(400);
  expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid query parameters' }));
});

it('returns 400 when number query param is not a positive integer', async () => {
  const { res, status, json } = mockVercelRes();
  await handler(mockVercelReq({ query: { repo: 'org/repo', number: 'abc' } }), res);
  expect(status).toHaveBeenCalledWith(400);
});
```

---

## Info

### IN-01: Unused i18n key `promote.pendingAriaLabel` defined in both locale files but never referenced in the component

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:97` / `apps/web/src/shared/i18n/locales/fr/issues.json:97`

**Issue:** Both `en/issues.json` and `fr/issues.json` define `promote.pendingAriaLabel` ("Promoting issue to backlog…" / "Promotion de l'issue en cours…"). The `IssueDetailPanel` component uses a static `aria-label` referencing only `promote.ariaLabel` and does not switch to a pending label while `promoteMutation.isPending` is `true`. Dead i18n keys accumulate translation debt.

**Fix:** Either use the key in the component to provide a better pending `aria-label`:

```tsx
aria-label={promoteMutation.isPending
  ? t('promote.pendingAriaLabel')
  : t('promote.ariaLabel')}
```

Or remove `promote.pendingAriaLabel` from both locale files if the simpler static label is intentionally chosen.

---

### IN-02: `View in Backlog` badge is not keyboard-accessible — interactive element nested inside `<Badge>` without `role` or `tabIndex`

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:459-462`

**Issue:** The "View in Backlog" state renders as `<Badge variant="success" className="cursor-pointer ..."><a href=...>...</a></Badge>`. The `<Badge>` wrapper has `cursor-pointer` which implies clickability, but the actual navigation is handled by the inner `<a>` tag. The outer `<Badge>` renders as a `<span>` with no focusable role. This is not broken (the inner `<a>` is keyboard-navigable) but the `cursor-pointer` on the outer `<span>` and the wrapping structure is misleading. It could be simplified to a plain anchor button to match the promote button pattern:

```tsx
<Button variant="outline" size="sm" asChild>
  <a href={`/products/${productId}`}>
    <ExternalLink className="h-3 w-3 mr-1" />
    {t('promote.viewInBacklog')}
  </a>
</Button>
```

---

### IN-03: `index.test.ts` for the duplicate-guard path does not test the case where `getTaskByGitHubIssue` returns `null` after the UNIQUE collision

**File:** `apps/web/api/tasks/index.test.ts:54-69`

**Issue:** The 409 test asserts the case where `getTaskByGitHubIssue` resolves to an existing task. There is no test for when the race-window lookup returns `null` (the row was deleted between the failed insert and the lookup). In that scenario the handler returns `{ error: '...', existingTask: null }` — a 409 with a null task — and the client `IssueDetailPanel` would render the duplicate toast but have no task to link. This is a low-probability race but the contract should be documented and tested.

**Fix:** Add one additional test case:

```typescript
it('returns 409 with existingTask: null when lookup finds nothing after constraint error', async () => {
  vi.mocked(createTask).mockRejectedValue(
    new Error('UNIQUE constraint failed: tasks.github_repo, tasks.github_issue_number')
  );
  vi.mocked(getTaskByGitHubIssue).mockResolvedValue(null);

  const { res, status, json } = mockVercelRes();
  await handler(mockVercelReq(), res);

  expect(status).toHaveBeenCalledWith(409);
  expect(json).toHaveBeenCalledWith({
    error: 'This issue is already in the backlog.',
    existingTask: null,
  });
});
```

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
