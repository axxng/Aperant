---
phase: 05-triage-actions
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - apps/web/src/client/components/IssueDetailPanel.tsx
  - apps/web/src/client/components/IssuesView.tsx
  - apps/web/src/client/components/AllIssuesView.tsx
  - apps/web/src/client/components/IssuesView.test.tsx
  - apps/web/src/client/components/IssueDetailPanel.test.tsx
  - apps/web/scripts/mocks/github-fixtures.ts
  - apps/web/src/shared/i18n/locales/en/issues.json
  - apps/web/src/shared/i18n/locales/fr/issues.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 05: Code Review Report (Gap Closure 05-05)

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This review covers the Phase 05 gap-closure plan 05-05, which fixed four UAT bugs: X close button with `onClose` prop on `IssueDetailPanel`, Escape-key handler in `IssuesView`/`AllIssuesView`, j/k navigation direction swap (j=prev, k=next), mock fixture state filtering, and the `useMutation` stale-closure fix using the variables pattern.

The implementations are structurally sound. The stale-closure fix (gap 4) is correctly applied — `owner`, `repo`, and `number` are passed as mutation variables rather than captured from the render closure. The Escape key handler and j/k direction swap are correctly implemented with identical logic in both `IssuesView` and `AllIssuesView`.

Three warnings were found: non-null assertions on `issue` inside event handlers that can throw if `issue` unmounts concurrently, the mock labels endpoint returning a bare array instead of the `{ labels: [] }` object shape expected by the consumer, and the `lucide-react` mock in `IssueDetailPanel.test.tsx` omitting the `X` icon which leaves the primary UAT-gap-1 fix (close button) with no test coverage. Four informational items cover an unsafe priority type cast, dead i18n keys, fragile test mock shape, and incomplete TRIAGE-03 `.todo` tests.

No critical security or correctness issues were found.

---

## Warnings

### WR-01: Non-null assertion on `issue` inside event handlers — throws if issue becomes null after dropdown opens

**File:** `apps/web/src/client/components/IssueDetailPanel.tsx:178`, `apps/web/src/client/components/IssueDetailPanel.tsx:208`, `apps/web/src/client/components/IssueDetailPanel.tsx:217`
**Issue:** `issue!.number` is used in three `onClick`/`onSelect` callbacks (TriagedToggle at line 178, priority DropdownMenuItems at line 208, and Clear priority at line 217). The `issue` prop is typed `GitHubIssue | null` (line 30), and while the parent JSX guard at line 126 (`{issue && (...)}`) prevents rendering when `issue` is null, callbacks capture the closure value at creation time. In React 19 concurrent mode, a re-render can nullify `issue` between the render pass that created the handler and the user's click dispatch. If `issue` becomes `null` after the dropdown opens but before selection, `issue!.number` will throw a runtime `TypeError: Cannot read properties of null`.
**Fix:**
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

// Clear priority onSelect (line 217):
onSelect={() => {
  if (!issue) return;
  triageMutation.mutate({ priority: null, owner, repo, number: issue.number });
}}
```

---

### WR-02: Mock labels endpoint returns bare array — mismatches `LabelsResult` shape expected by `IssuesView`

**File:** `apps/web/scripts/mocks/github-fixtures.ts:165-167`
**Issue:** The labels mock handler at line 165 responds with `buildLabelFixtures()` directly — a bare `LabelFixture[]` array. However, `IssuesView.tsx` types the response as `LabelsResult` (defined at lines 23-25 as `{ labels: GitHubLabel[] }`) and reads it as `labelsData?.labels`. The mock therefore delivers `undefined` for `labelsData?.labels`, which is then passed as `availableLabels={[]}` to `IssuesFilterBar`. Label filters will always be empty in the mock dev environment regardless of which labels exist in the fixture data. This is a silent data-shape mismatch that only manifests when `MOCK_SERVICES=true`.
**Fix:**
```typescript
app.get('/api/github/repos/:owner/:repo/labels', (_req: Request, res: Response) => {
  res.json({ labels: buildLabelFixtures() }); // wrap to match LabelsResult shape
});
```

---

### WR-03: `lucide-react` mock in `IssueDetailPanel.test.tsx` omits `X` icon — close button has zero test coverage

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:44-49`
**Issue:** The `lucide-react` mock maps `ExternalLink`, `CheckCircle2`, `Circle`, and `AlertTriangle` but omits `X`. `IssueDetailPanel.tsx` imports and renders `<X />` inside the close button (line 149). When the mock does not define `X`, the import resolves to `undefined` and React silently renders nothing. Consequences:

1. The close button icon renders as nothing in tests — silently degraded
2. There is no test that verifies the `onClose` callback is called when the close button is clicked — the primary fix for UAT gap 1 has no regression protection

**Fix:**
```typescript
// Add X to the lucide-react mock:
vi.mock('lucide-react', () => ({
  ExternalLink: () => <svg data-testid="external-link" />,
  CheckCircle2: ({ 'aria-label': al }: { 'aria-label'?: string }) => <svg data-testid="check-circle-2" aria-label={al} />,
  Circle: () => <svg data-testid="circle" />,
  AlertTriangle: () => <svg data-testid="alert-triangle" />,
  X: () => <svg data-testid="close-icon" />,
}));

// Add a test for the onClose prop:
it('calls onClose when close button is clicked', () => {
  const onClose = vi.fn();
  setupMocks({ isTriaged: false, priority: null });
  render(<IssueDetailPanel issue={baseIssue} isOpen={true} onClose={onClose} />);
  fireEvent.click(screen.getByLabelText('Toggle triaged status')); // replace with aria-label for close button
  // Use: screen.getByRole('button', { name: /close panel/i }) or the aria-label key
  expect(onClose).toHaveBeenCalledTimes(1);
});
```

---

## Info

### IN-01: Unsafe priority cast — invalid string values from API pass through `handleTriageLoad` silently

**File:** `apps/web/src/client/components/IssuesView.tsx:44`, `apps/web/src/client/components/AllIssuesView.tsx:30`
**Issue:** `const priority = triageState.priority as 'critical' | 'high' | 'medium' | 'low' | null;` is a bare TypeScript cast with no runtime validation. If the API ever returns an unknown value (e.g., `"urgent"` after a schema migration), it is cast without error and stored in `issueTriageCache`. When the value reaches `PRIORITY_DOT_CLASSES[p]` in `IssueDetailPanel.tsx`, it returns `undefined`, producing a pill with no colour class — silent visual degradation, no crash.
**Fix:**
```typescript
const VALID_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const priority = VALID_PRIORITIES.has(triageState.priority ?? '')
  ? (triageState.priority as 'critical' | 'high' | 'medium' | 'low')
  : null;
```

---

### IN-02: Dead i18n key `triage.triagedAriaLabel` — never referenced in source, present in both locales

**File:** `apps/web/src/shared/i18n/locales/en/issues.json:68`, `apps/web/src/shared/i18n/locales/fr/issues.json:68`
**Issue:** Both locale files define `triage.triagedAriaLabel`. The component uses only `triage.markTriagedAriaLabel` (a single key for both triaged and untriaged states, per `IssueDetailPanel.tsx` line 175). The `triagedAriaLabel` key is unused and creates confusion about which key controls the aria-label.
**Fix:** Remove `triage.triagedAriaLabel` from both `en/issues.json` and `fr/issues.json`.

---

### IN-03: `useTranslation` mock in `IssuesView.test.tsx` exposes a property `tNav` that `useTranslation` does not return

**File:** `apps/web/src/client/components/IssuesView.test.tsx:7`
**Issue:** The mock returns `{ t: (k: string) => k, tNav: (k: string) => k }`. The real `useTranslation` hook returns `{ t }` — not `{ t, tNav }`. In `IssuesView`, `tNav` is a destructured second `useTranslation` call (`const { t: tNav } = useTranslation('navigation')`), not a field on the first call's return. The mock is harmless because both `t` and `tNav` in the component end up as identity functions, but the extra `tNav` property on the mock return is misleading and could mask future breakage if a developer relies on the mock shape.
**Fix:**
```typescript
vi.mock('react-i18next', () => ({
  useTranslation: (_ns?: string) => ({ t: (k: string) => k }),
}));
```

---

### IN-04: TRIAGE-03 optimistic update rollback tests remain `.todo` — zero coverage for the rollback path

**File:** `apps/web/src/client/components/IssueDetailPanel.test.tsx:161-164`
**Issue:** Three `it.todo` stubs cover `onMutate`/`onError` rollback behaviour. The rollback path (lines 90-93 in `IssueDetailPanel.tsx`) is the safety net for the mutation — it restores optimistic state and shows the error toast. With `.todo`, a future regression in this path (e.g., wrong query key in rollback, toast not called) would not be caught. Per the project's Red-Green TDD principle, these should be implemented.
**Fix:** Capture the `useMutation` callbacks in the mock by inspecting the argument passed to `vi.mocked(useMutation).mock.calls`, then invoke `onMutate`/`onError` directly to test the rollback contract against `mockQueryClient`.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
