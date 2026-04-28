---
phase: 05-triage-actions
reviewed: 2026-04-22T08:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/web/api/_lib/db/triage.ts
  - apps/web/api/_lib/db/triage.test.ts
  - apps/web/api/_lib/validation.ts
  - apps/web/api/triage/[owner]/[repo].ts
  - apps/web/scripts/mocks/github-fixtures.ts
  - apps/web/src/client/components/AllIssuesView.tsx
  - apps/web/src/client/components/AllIssuesView.test.tsx
  - apps/web/src/client/components/IssueDetailPanel.tsx
  - apps/web/src/client/components/IssueDetailPanel.test.tsx
  - apps/web/src/client/components/IssueListRow.tsx
  - apps/web/src/client/components/IssueListRow.test.tsx
  - apps/web/src/client/components/IssuesView.tsx
  - apps/web/src/client/components/IssuesView.test.tsx
  - apps/web/src/shared/i18n/locales/en/issues.json
  - apps/web/src/shared/i18n/locales/fr/issues.json
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-22T08:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This review covers the complete Phase 05 triage-actions file set: the DB layer, batch API endpoint, mock fixtures, both issue-list views, the detail panel, the list row component, tests, and i18n files.

The core data-flow is sound. Parse-don't-validate is applied at DB boundaries (`triageDbRowSchema`, `triageBatchRowSchema`) and at the query-param boundary (`batchQuerySchema`). The `TriageState` discriminated union correctly eliminates illegal states. The 4-step handler shape is followed in the triage batch endpoint. The optimistic mutation pattern with rollback on error is structurally correct — owner/repo/number are passed as mutation variables to avoid stale-closure capture.

Two recurring issues stand out. First, `upsertTriageRecord` uses a non-atomic two-step write (INSERT then UPDATE) without a transaction, creating a race window for concurrent requests. Second, several non-null assertions and bare type casts exist without runtime guards. Additionally, the previous review's WR-02 (mock labels endpoint returning a bare array instead of `{ labels: [] }`) and WR-03 (`X` icon missing from test mock) carry forward as they are still present in the codebase.

---

## Warnings

### WR-01: Non-atomic upsert — race condition between INSERT and UPDATE

**File:** `apps/web/api/_lib/db/triage.ts:57-79`
**Issue:** `upsertTriageRecord` performs two separate `execute()` calls — an `INSERT ... DO NOTHING` to ensure the row exists, then a dynamic `UPDATE`. If two concurrent requests arrive for the same `(repo, issueNumber)` and interleave between these steps, both will INSERT (do-nothing), then one's UPDATE will silently overwrite the other's. There is also no transactional guarantee: a crash between the two statements leaves the row at default "untouched" state even though the caller expected the update to be applied.
**Fix:** Collapse into a single atomic `INSERT ... ON CONFLICT DO UPDATE` statement:
```sql
INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority, updated_at)
VALUES (?, ?, ?, ?, datetime('now'))
ON CONFLICT(github_repo, github_issue_number) DO UPDATE SET
  is_triaged = excluded.is_triaged,
  priority   = excluded.priority,
  updated_at = datetime('now')
```
If dynamic partial-update semantics must be preserved (only patch supplied fields), wrap both statements in a Turso batch transaction using `client.batch([...], 'write')`.

---

### WR-02: Non-null assertion after SELECT-after-upsert may throw unhandled TypeError

**File:** `apps/web/api/_lib/db/triage.ts:82`
**Issue:** `return record!;` asserts the post-upsert `getTriageRecord` can never return `null`. If the row is deleted by a concurrent migration or another process between the UPDATE and SELECT (an edge case, but possible), `record` is `null` and the `!` causes a `TypeError` at runtime. The calling PUT handler has no `try/catch`, so this propagates as an unhandled rejection (500 with no message).
**Fix:**
```typescript
const record = await getTriageRecord(repo, issueNumber);
if (!record) {
  throw new Error(`Triage record for ${repo}#${issueNumber} not found after upsert`);
}
return record;
```

---

### WR-03: Non-null assertions on `issue` inside event handlers in `IssueDetailPanel`

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:178, 208, 217`
**Issue:** `issue!.number` appears in three `onClick`/`onSelect` callbacks: the TriagedToggle (line 178), each priority DropdownMenuItem (line 208), and the Clear option (line 217). The prop is typed `GitHubIssue | null` (line 30). In React 19 concurrent mode a re-render can nullify `issue` between the render pass that created the handler and the moment the user's click dispatches. If that happens, `issue!.number` throws a `TypeError`.
**Fix:** Guard each callback:
```typescript
// TriagedToggle onClick (line 178):
onClick={() => {
  if (!issue) return;
  triageMutation.mutate({ isTriaged: !(triageData?.isTriaged ?? false), owner, repo, number: issue.number });
}}
// Priority DropdownMenuItem onSelect (line 208):
onSelect={() => {
  if (!issue) return;
  triageMutation.mutate({ priority: p, owner, repo, number: issue.number });
}}
// Clear onSelect (line 217):
onSelect={() => {
  if (!issue) return;
  triageMutation.mutate({ priority: null, owner, repo, number: issue.number });
}}
```

---

### WR-04: Mock labels endpoint returns bare array — mismatches `LabelsResult` shape in `IssuesView`

**File:** `apps/web/scripts/mocks/github-fixtures.ts:165-167`
**Issue:** The mock handler responds with `buildLabelFixtures()` — a bare `LabelFixture[]`. `IssuesView` types the response as `LabelsResult` (`{ labels: GitHubLabel[] }`) and reads `labelsData?.labels`. The mock therefore delivers `undefined` for `labelsData?.labels`, so label filters are always empty in the mock dev environment. This is a silent data-shape mismatch between mock and production handler.
**Fix:**
```typescript
app.get('/api/github/repos/:owner/:repo/labels', (_req: Request, res: Response) => {
  res.json({ labels: buildLabelFixtures() }); // match LabelsResult shape
});
```

---

### WR-05: `lucide-react` mock in `IssueDetailPanel.test.tsx` omits `X` icon — close button has no test coverage

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:44-49`
**Issue:** The mock exports `ExternalLink`, `CheckCircle2`, `Circle`, `AlertTriangle`, but not `X`. `IssueDetailPanel.tsx` imports and renders `<X />` for the close button (line 149). With the mock omitting it, the import resolves to `undefined` and React renders nothing. No test exercises the `onClose` callback, leaving the close-button fix with no regression protection.
**Fix:**
```typescript
vi.mock('lucide-react', () => ({
  ExternalLink: () => <svg data-testid="external-link" />,
  CheckCircle2: ({ 'aria-label': al }: { 'aria-label'?: string }) => <svg data-testid="check-circle-2" aria-label={al} />,
  Circle: () => <svg data-testid="circle" />,
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
  X: () => <svg data-testid="close-icon" />,
}));
```
Then add a test:
```typescript
it('calls onClose when close button is clicked', () => {
  const onClose = vi.fn();
  setupMocks({ isTriaged: false, priority: null });
  render(<IssueDetailPanel issue={baseIssue} isOpen={true} onClose={onClose} />);
  fireEvent.click(screen.getByLabelText('Close panel'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

---

### WR-06: TRIAGE-03 optimistic-update rollback tests remain `.todo` — zero coverage for the rollback path

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:161-164`
**Issue:** Three `it.todo` stubs cover `onMutate`/`onError` rollback behaviour. The rollback path (lines 90-93 in `IssueDetailPanel.tsx`) is the mutation's safety net. With `.todo`, a regression in this path — e.g., wrong query key in rollback, toast not fired — would not be caught. Per the project's Red-Green TDD principle, these must be implemented.
**Fix:** Capture the callbacks from the mock call and invoke them directly:
```typescript
it('onError restores previous query data via queryClient.setQueryData', () => {
  const { mockQueryClient } = setupMocks({ isTriaged: true, priority: null });
  render(<IssueDetailPanel issue={baseIssue} isOpen={true} />);
  const [mutationOptions] = vi.mocked(useMutation).mock.calls[0];
  const context = { previous: { isTriaged: true, priority: null }, vars: { owner: 'org', repo: 'repo', number: 42 } };
  mutationOptions.onError?.(new Error('fail'), context.vars, context);
  expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
    ['triage', 'org', 'repo', 42],
    context.previous
  );
});
```

---

## Info

### IN-01: Unsafe priority cast in `handleTriageLoad` — invalid strings pass through silently

**File:** `apps/web/src/client/components/IssuesView.tsx:44` and `apps/web/src/client/components/AllIssuesView.tsx:30`
**Issue:** `const priority = triageState.priority as 'critical' | 'high' | 'medium' | 'low' | null;` is a bare cast with no runtime validation. An unexpected API value (e.g., `"urgent"`) is stored in `issueTriageCache`. When that value reaches `PRIORITY_PILL_CLASSES[triageState.priority]` in `IssueListRow`, it returns `undefined`, producing a pill with no colour class — silent visual degradation.
**Fix:**
```typescript
const VALID_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const priority = VALID_PRIORITIES.has(triageState.priority ?? '')
  ? (triageState.priority as 'critical' | 'high' | 'medium' | 'low')
  : null;
```

---

### IN-02: Dead i18n key `triage.triagedAriaLabel` in both locale files

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:68` and `apps/web/src/shared/i18n/locales/fr/issues.json:68`
**Issue:** Both locale files define `triage.triagedAriaLabel`. The component uses only `triage.markTriagedAriaLabel` (a single key for both states, per `IssueDetailPanel.tsx` line 175). `triagedAriaLabel` is never consumed and creates confusion about which key controls the aria-label.
**Fix:** Remove `triage.triagedAriaLabel` from both `en/issues.json` and `fr/issues.json`.

---

### IN-03: `useTranslation` mock in `IssuesView.test.tsx` exposes a non-existent `tNav` property

**File:** `apps/web/src/client/components/IssuesView.test.tsx:7`
**Issue:** The mock returns `{ t: (k: string) => k, tNav: (k: string) => k }`. The real `useTranslation` hook returns `{ t }` — not `{ t, tNav }`. In `IssuesView`, `tNav` comes from a separate `useTranslation('navigation')` call (`const { t: tNav } = useTranslation('navigation')`). The extra `tNav` field on the single mock return object is misleading — it works today because both identity functions behave the same, but it misrepresents the hook contract.
**Fix:**
```typescript
vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (k: string) => k }),
}));
```

---

### IN-04: Mock triage route skips `numbers` format validation that production enforces

**File:** `apps/web/scripts/mocks/github-fixtures.ts:171-176`
**Issue:** The mock triage route does not validate the `numbers` query parameter format — it silently filters out `NaN` values but accepts strings like `abc`. The production handler enforces `/^\d+(,\d+)*$/` via `batchQuerySchema`. A client bug that sends malformed `numbers` would be hidden in dev (mock returns empty records) but produce a 400 in production.
**Fix:**
```typescript
app.get('/api/triage/:owner/:repo', (req: Request, res: Response) => {
  const numbersRaw = req.query.numbers;
  if (typeof numbersRaw !== 'string' || !/^\d+(,\d+)*$/.test(numbersRaw)) {
    return res.status(400).json({ error: 'Invalid numbers parameter' });
  }
  const numbers = numbersRaw.split(',').map(Number).filter(n => n > 0);
  res.json({ records: numbers.map(issueNumber => ({ issueNumber, isTriaged: false, priority: null })) });
});
```

---

### IN-05: ESLint-disable comment in Biome project is dead annotation

**File:** `apps/web/src/client/components/AllIssuesView.tsx:144` and `apps/web/src/client/components/IssuesView.tsx:172`
**Issue:** `// eslint-disable-line react-hooks/exhaustive-deps` appears on the batch-prefetch `useEffect` in both view components. The project uses Biome (not ESLint), so this directive is never processed. The intent is valid (seeding-only — not wanting to re-fetch when cache already populated), but it should be documented with a plain comment instead.
**Fix:**
```typescript
// repoSource/issueTriageCache intentionally omitted: this effect only seeds
// cache entries that are absent; re-running on cache changes would overwrite
// optimistic updates already applied by onTriageLoad.
}, [filteredIssues]);
```

---

_Reviewed: 2026-04-22T08:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
