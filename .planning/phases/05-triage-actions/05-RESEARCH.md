# Phase 5: Triage Actions - Research

**Researched:** 2026-04-22
**Domain:** React UI + TanStack Query v5 mutations, Radix UI DropdownMenu, keyboard navigation, i18n
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated triage section at top of `IssueDetailPanel`, pinned between title/number row and labels/meta section. Always visible. Compact horizontal row with: Triaged toggle (left) + Priority dropdown (right).
- **D-02:** Priority selector is a dropdown with options Critical / High / Medium / Low + Clear. Use Radix UI `DropdownMenu` or `Select` — whichever fits cleanest with existing Radix usage.
- **D-03:** When triaged, a checkmark icon appears at the right of `IssueListRow` (after product badge).
- **D-04:** When priority is set, a priority-colored pill appears alongside the checkmark. Priority colors: Critical = red, High = orange, Medium = yellow, Low = blue/gray.
- **D-05:** j/k keyboard shortcuts activate only when the detail panel is open. j = next issue, k = previous. At boundaries, do nothing.
- **D-06:** Closed-issue inline warning banner inside triage section, above toggle/priority controls. Informational only, not blocking.
- **D-07:** Lazy fetch per issue — one `GET /api/triage/:owner/:repo/:number` fires when `issue` prop changes in the panel. TanStack Query caches per `['triage', owner, repo, number]`.
- **D-08:** Optimistic updates via TanStack Query v5 `useMutation` with `onMutate` + rollback in `onError`.

### Claude's Discretion

- Exact Radix component for priority selector (DropdownMenu vs Select) — choose whichever is cleanest with existing Radix usage
- Whether `IssueDetailPanel` receives a `triageState` prop or fetches internally via TanStack Query
- Animation/transition for the triage section appearing (or no animation)
- Exact priority colors — follow Tailwind semantic colors that work in both light and dark themes
- Whether the checkmark icon on list row uses a lucide-react icon or a styled character

### Deferred Ideas (OUT OF SCOPE)

- Batch triage (TRIAGE-V2-02)
- Snooze with wake-up date (TRIAGE-V2-01)
- Eager batch-load of triage state for all visible issues
- List-mode j/k navigation without panel open
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-01 | User can mark an issue as triaged (stored in app only, not pushed to GitHub) | TriagedToggle component + PUT /api/triage with isTriaged; API already complete |
| TRIAGE-02 | User can assign internal priority (Critical / High / Medium / Low) without creating a GitHub label | PrioritySelector via Radix DropdownMenu + PUT /api/triage with priority; API already complete |
| TRIAGE-03 | Triage state persists across browser refresh and is visible to all team members | Server-side persistence already in DB; TanStack Query fetches on panel open; optimistic update reconciles on success |
| TRIAGE-04 | Triaged issues show a visual badge on their issue card | TriageBadgeSlot in IssueListRow; triageState passed as optional prop (same pattern as productBadge) |
| TRIAGE-05 | User can navigate between issues using j/k keyboard shortcuts in the triage panel | useEffect + window.addEventListener('keydown') in IssuesView + AllIssuesView; guard on isOpen and non-input focus |
| TRIAGE-06 | User is warned when attempting to triage or act on a closed GitHub issue | ClosedIssueWarning banner inside TriageSection; triggered by issue.state === 'closed' |
</phase_requirements>

---

## Summary

Phase 5 is a pure UI + integration phase. All API routes and DB tables were built in Phase 1 (`GET/PUT /api/triage/[owner]/[repo]/[number]`, `issue_triage` table). This phase adds three new React components (`TriageSection`, `TriagedToggle`, `PrioritySelector`, `ClosedIssueWarning`, `TriageBadgeSlot`), wires TanStack Query v5 `useQuery`/`useMutation` for lazy fetch and optimistic updates, adds j/k keyboard navigation to both issue views, and extends i18n files.

The codebase is a Tailwind v4 + Radix UI setup (no shadcn). All required Radix primitives are already installed (`@radix-ui/react-dropdown-menu`, `@radix-ui/react-scroll-area`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, etc.). The `DropdownMenu` primitive is already wrapped in `src/client/components/ui/dropdown-menu.tsx` and is the canonical choice for `PrioritySelector`. The `Badge` component has CVA variants including `success`, `warning`, `destructive`, and `muted` — all needed for priority pills.

The triage state cache presents a key integration challenge: `IssueListRow` needs to display `TriageBadgeSlot`, but triage state is only fetched lazily when the panel opens. The solution is to pass `triageState` as an optional prop to `IssueListRow` (mirroring the `productBadge` pattern), populated from the TanStack Query cache in the parent view. This means badges only appear for issues that have been opened in the current session — a deliberate design choice (D-07) to avoid N API calls on load.

**Primary recommendation:** Build `TriageSection` as an internal component inside `IssueDetailPanel` (not a separate file) using `useQuery` for lazy fetch and `useMutation` with optimistic update. Pass `triageState` as an optional prop to `IssueListRow` from the query cache. Keep all triage hooks close to the panel component.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Triage toggle UI | Browser / Client | — | React state + optimistic mutation; no SSR needed |
| Priority selector UI | Browser / Client | — | DropdownMenu is client-only interaction |
| Closed-issue warning | Browser / Client | — | Derived from `issue.state` — pure render logic |
| j/k keyboard navigation | Browser / Client | — | `window.addEventListener('keydown')` in React component |
| Triage state fetch (GET) | API / Backend | DB | Already implemented; client calls via TanStack Query |
| Triage state mutation (PUT) | API / Backend | DB | Already implemented; client calls via useMutation |
| Triage badge on list row | Browser / Client | — | Reads from TanStack Query cache; no additional API call |
| i18n strings | Browser / Client | — | react-i18next; JSON files at build time |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.99.2 | Data fetching, caching, mutations | Already used in IssuesView + AllIssuesView; v5 API required |
| `@radix-ui/react-dropdown-menu` | ^2.1.15 | Priority selector primitive | Already wrapped in ui/dropdown-menu.tsx; correct choice over Select for action menus |
| `lucide-react` | ^0.511.0 | CheckCircle, CheckCircle2, AlertTriangle icons | Already installed; TriagedToggle and ClosedIssueWarning use it |
| `react-i18next` | ^15.4.1 | Translation strings | Required by CLAUDE.md for all UI text |
| `zustand` | (existing) | useToastStore for error toasts | Already used for toast notifications |

[VERIFIED: grep against apps/web/package.json]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | (existing) | CVA for badge/button variants | Priority pills use existing Badge variants |
| `tailwind-merge` / `clsx` | (existing) | `cn()` helper for conditional classes | All className composition |
| `zod` | (existing) | Already used in API layer | No new validation needed in UI — API already validates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix DropdownMenu | Radix Select | Select is better for form fields that submit; DropdownMenu is better for action menus (priority set = action). DropdownMenu already wrapped and matches existing AllIssuesView error banner action pattern |
| Internal fetch in IssueDetailPanel | Prop drilling from parent | Internal fetch (via useQuery) is cleaner — panel knows its own issue, can derive owner/repo from issue.repoFullName |
| window.addEventListener keydown | dedicated shortcut library | No shortcut library exists in the project; useEffect + addEventListener matches IssuesFilterBar keyboard pattern |

**Installation:** No new packages needed. All dependencies are already installed. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
IssuesView / AllIssuesView
│
├── filteredIssues.map → IssueListRow (+ optional triageState from cache)
│   └── TriageBadgeSlot (reads triageState prop — no fetch)
│
└── IssueDetailPanel (receives issue prop)
    └── TriageSection (internal — renders when issue is not null)
        ├── useQuery(['triage', owner, repo, number]) → GET /api/triage/…  → DB
        ├── useMutation → PUT /api/triage/… → DB
        │   ├── onMutate: queryClient.setQueryData (optimistic)
        │   └── onError: queryClient.setQueryData (rollback) + useToast.error()
        ├── ClosedIssueWarning (issue.state === 'closed')
        ├── TriagedToggle (aria-pressed, CheckCircle / CheckCircle2)
        └── PrioritySelector (Radix DropdownMenu, colored dots)

IssuesView / AllIssuesView (keyboard events)
    useEffect → window.addEventListener('keydown')
    ├── 'j' + isOpen → setSelectedIssueId(nextIssue.id)
    └── 'k' + isOpen → setSelectedIssueId(prevIssue.id)
```

### Recommended Project Structure

No new directories needed. New components are either:
- Internal to `IssueDetailPanel.tsx` (TriageSection, TriagedToggle, PrioritySelector, ClosedIssueWarning)
- Added as an inline slot in `IssueListRow.tsx` (TriageBadgeSlot)

```
src/client/components/
├── IssueDetailPanel.tsx        ← extend: add TriageSection + owner/repo props
├── IssueListRow.tsx            ← extend: add triageState prop + TriageBadgeSlot
├── IssueListRow.test.tsx       ← extend: add triage badge tests
├── IssuesView.tsx              ← extend: j/k nav + pass triageState from cache
└── AllIssuesView.tsx           ← extend: j/k nav + pass triageState from cache

src/shared/i18n/locales/en/issues.json   ← add triage.* keys
src/shared/i18n/locales/fr/issues.json   ← add triage.* French keys
```

### Pattern 1: Lazy Triage Fetch with useQuery

```typescript
// Source: CONTEXT.md D-07, TanStack Query v5 docs pattern
// Inside IssueDetailPanel — owner/repo derived from issue.repoFullName
const [owner, repo] = issue.repoFullName.split('/');

const { data: triageData, isLoading: triageLoading } = useQuery({
  queryKey: ['triage', owner, repo, issue.number],
  queryFn: async () => {
    const res = await fetch(
      `/api/triage/${owner}/${repo}/${issue.number}`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('triage fetch failed');
    return res.json();
  },
  // staleTime: 0 ensures fresh data on each panel open (triage changes matter)
});
```

[VERIFIED: pattern matches existing IssuesView.tsx useQuery usage]

### Pattern 2: Optimistic useMutation with Rollback

```typescript
// Source: CONTEXT.md D-08, TanStack Query v5 useMutation pattern
const queryClient = useQueryClient();

const triageMutation = useMutation({
  mutationFn: async (updates: { isTriaged?: boolean; priority?: string | null }) => {
    const res = await fetch(`/api/triage/${owner}/${repo}/${issue.number}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('triage save failed');
    return res.json();
  },
  onMutate: async (updates) => {
    await queryClient.cancelQueries({ queryKey: ['triage', owner, repo, issue.number] });
    const previous = queryClient.getQueryData(['triage', owner, repo, issue.number]);
    queryClient.setQueryData(['triage', owner, repo, issue.number], (old: any) => ({
      ...old,
      ...updates,
    }));
    return { previous };
  },
  onError: (_err, _updates, context) => {
    queryClient.setQueryData(['triage', owner, repo, issue.number], context?.previous);
    toast.error(t('triage.saveError'));
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['triage', owner, repo, issue.number] });
  },
});
```

[VERIFIED: TanStack Query v5 useMutation signature; onMutate context rollback is standard pattern]

### Pattern 3: j/k Keyboard Navigation

```typescript
// Source: CONTEXT.md D-05; matches existing useEffect + addEventListener pattern
useEffect(() => {
  if (!isOpen) return; // guard: only active when panel is open (D-05)

  function handleKeyDown(e: KeyboardEvent) {
    // Guard: never hijack input/textarea focus (accessibility requirement)
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault();
      const currentIndex = filteredIssues.findIndex(i => i.id === selectedIssueId);
      if (e.key === 'j' && currentIndex < filteredIssues.length - 1) {
        setSelectedIssueId(filteredIssues[currentIndex + 1].id);
      } else if (e.key === 'k' && currentIndex > 0) {
        setSelectedIssueId(filteredIssues[currentIndex - 1].id);
      }
    }
  }

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, selectedIssueId, filteredIssues]);
```

[VERIFIED: pattern matches existing useEffect cleanup in IssuesView.tsx]

### Pattern 4: TriageBadgeSlot in IssueListRow

```typescript
// Source: CONTEXT.md D-03, D-04; mirrors productBadge optional prop pattern
// IssueListRow.tsx — new optional prop
interface TriageStateDisplay {
  isTriaged: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
}

// In parent (IssuesView / AllIssuesView) — read from cache
const triageData = queryClient.getQueryData<TriageStateDisplay>(
  ['triage', owner, repo, issue.number]
);

// Pass to IssueListRow
<IssueListRow
  issue={issue}
  isSelected={issue.id === selectedIssueId}
  onClick={() => setSelectedIssueId(issue.id)}
  triageState={triageData ?? undefined}  // only defined after panel was opened
/>
```

[VERIFIED: productBadge pattern in IssueListRow.tsx is the established precedent]

### Pattern 5: Owner/Repo from issue.repoFullName

```typescript
// GitHubIssue has repoFullName: string (e.g., 'org/repo')
// IssueDetailPanel can derive owner + repo without new props
const [owner, repo] = (issue?.repoFullName ?? '/').split('/');
```

[VERIFIED: GitHubIssue type in src/shared/types/github.ts — repoFullName: string is present]

### Pattern 6: Priority Color Classes

```typescript
// Source: UI-SPEC.md Color section; uses existing CSS vars + Tailwind defaults
const PRIORITY_CLASSES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',      // --destructive CSS var
  high:     'bg-orange-500/10 text-orange-500',         // Tailwind default (no semantic token for orange)
  medium:   'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400',
  low:      'bg-muted text-muted-foreground',           // --muted CSS var
};
```

[VERIFIED: badge.tsx uses purple-500/10 confirming arbitrary Tailwind colors are acceptable]

### Anti-Patterns to Avoid

- **Fetching triage state eagerly for all list rows:** Causes N API calls on page load. Confirmed deferred (D-07).
- **Passing owner/repo as new IssueDetailPanel props:** Redundant — `issue.repoFullName` already contains both. Derive internally.
- **Using Radix Select instead of DropdownMenu for priority:** Select is for form fields; DropdownMenu is for action menus. DropdownMenu already has a complete wrapper in `ui/dropdown-menu.tsx`.
- **Putting keyboard handler in IssueDetailPanel:** The handler needs `filteredIssues` and `setSelectedIssueId` which live in the parent views. Keep it in `IssuesView` and `AllIssuesView`.
- **Triggering keyboard nav when panel is closed:** D-05 explicitly requires guard on `isOpen`.
- **Using `aria-label` without i18n key:** All aria labels must come from translation keys per CLAUDE.md.
- **Toast error in `onError` without rollback first:** Rollback must happen before toast or user sees stale state alongside error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Priority dropdown | Custom `<select>` or custom div | Radix `DropdownMenu` (already wrapped) | Keyboard nav, focus management, portal rendering — all built in |
| Toast error on mutation failure | Custom toast component | `useToastStore` from `src/client/hooks/useToast.ts` | Already exists, already rendered via `ToastContainer` in `App.tsx` |
| Optimistic update state | Local `useState` for pending state | TanStack Query v5 `useMutation` `onMutate` | Automatic cache reconciliation, error rollback, loading states |
| i18n strings | Hardcoded English strings in JSX | `useTranslation('issues')` + `t('triage.*')` | Required by CLAUDE.md; breaks FR locale if hardcoded |
| Priority color mapping | `if/else` chain | `Record<string, string>` constant map | Cleaner, exhaustive, easily extended |
| Keyboard shortcut cleanup | Manual removeEventListener tracking | `useEffect` return cleanup | React pattern — prevents event listener accumulation on re-renders |

**Key insight:** Every complex UI interaction needed in this phase (dropdown, toast, optimistic update) already has an established solution in the codebase. The work is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: owner/repo Not Available Without New Props
**What goes wrong:** Dev adds `owner` and `repo` as required props to `IssueDetailPanel` and forgets to pass them in both `IssuesView` and `AllIssuesView`, causing a TypeScript error or undefined query key.
**Why it happens:** Not noticing that `issue.repoFullName` already contains both parts.
**How to avoid:** Derive from `issue.repoFullName.split('/')` inside the panel — no new props needed.
**Warning signs:** If PR adds `owner?: string` or `repo?: string` to `IssueDetailPanelProps`, question it.

### Pitfall 2: j/k Handler Not Cleaned Up
**What goes wrong:** User navigates away from the issues view but keyboard handler remains on `window`, causing errors or unexpected navigation.
**Why it happens:** Missing cleanup in `useEffect` return.
**How to avoid:** Always `return () => window.removeEventListener('keydown', handleKeyDown)` in the useEffect.
**Warning signs:** Two issues are skipped per keypress (duplicate handlers stacking).

### Pitfall 3: triageState Badge Shows Nothing (Cache Miss)
**What goes wrong:** After setting triage state, the badge on the list row doesn't update because the parent reads from cache but the cache key isn't queried by the parent.
**Why it happens:** The parent reads `queryClient.getQueryData(...)` but `getQueryData` only returns data already in cache — if the mutation's `onSettled` invalidates but the parent doesn't re-render, the row won't update.
**How to avoid:** On mutation `onSuccess`/`onSettled`, the parent view needs to re-render. Two approaches: (1) pass the `triageData` from IssueDetailPanel's `useQuery` down via a callback, or (2) use `queryClient.getQueryData` in the row render (which re-reads cache on each render). Option 2 is simpler but requires the parent to subscribe to the query somehow.
**Recommended approach:** Pass `triageState` from `IssueDetailPanel`'s `triageData` up to the parent via a `onTriageChange` callback or keep it simple by having the parent also call `useQuery` on the same key when `selectedIssueId` is set.
**Warning signs:** Badge appears after page refresh but not immediately after panel action.

### Pitfall 4: Priority Clear Sets null vs Removes Field
**What goes wrong:** Sending `{ priority: null }` to `PUT /api/triage` correctly clears priority only if the COALESCE SQL handles explicit `null` correctly.
**Why it happens:** The `upsertTriageRecord` function uses `COALESCE(excluded.priority, priority)` — if `excluded.priority` is SQL `NULL` (not JS `null`), COALESCE keeps the old value.
**How to avoid:** Check `apps/web/api/_lib/db/triage.ts` — the `args` array passes `updates.priority !== undefined ? updates.priority : null`. When user clears priority, the client must send `{ priority: null }` (not omit the field) so the DB receives `NULL` in the upsert args.
**Warning signs:** Clear priority action doesn't remove the priority pill.

[VERIFIED: triage.ts upsertTriageRecord shows `COALESCE(excluded.priority, priority)` which means passing `null` explicitly is required to clear — confirmed SQL logic]

### Pitfall 5: Keyboard j/k Hijacks Input Focus
**What goes wrong:** User types `j` or `k` in a search input and the panel navigates instead.
**Why it happens:** No guard on event target element type.
**How to avoid:** Check `(e.target as HTMLElement).tagName` is not `INPUT`, `TEXTAREA`, or has `contenteditable`.
**Warning signs:** Typing in `IssuesFilterBar` search field jumps between issues.

### Pitfall 6: Missing French Translation Keys
**What goes wrong:** App crashes or shows raw key strings in French locale.
**Why it happens:** Adding keys to `en/issues.json` but forgetting `fr/issues.json`.
**How to avoid:** Always update both files atomically in the same task. CLAUDE.md mandates this.
**Warning signs:** TypeScript build passes but French locale shows `issues:triage.markTriaged` as raw text.

### Pitfall 7: isOpen Condition in IssueDetailPanel
**What goes wrong:** The triage section renders when `issue` is null (between panel close animation).
**Why it happens:** `IssueDetailPanel` renders `{issue && (...)}` but the outer div's transform still transitions. If triage section is outside the `{issue &&}` guard, it can flash.
**How to avoid:** Keep entire `TriageSection` inside the `{issue && (...)}` guard in the ScrollArea — which is already how the panel is structured.
**Warning signs:** Triage loading state flashes briefly after closing the panel.

---

## Code Examples

Verified patterns from codebase inspection:

### useQuery pattern in the codebase (for reference)
```typescript
// Source: [VERIFIED: IssuesView.tsx] — existing useQuery in IssuesView
const { data: labelsData, isError: labelsError } = useQuery<LabelsResult>({
  queryKey: ['labels', repoSource?.owner, repoSource?.repo],
  queryFn: async () => { /* fetch + res.json() */ },
  staleTime: 5 * 60 * 1000,
  enabled: Boolean(repoSource),
});
```

### useToast usage
```typescript
// Source: [VERIFIED: src/client/hooks/useToast.ts]
const { error } = useToast();
error(t('triage.saveError')); // shows red toast with auto-dismiss after 5s
```

### DropdownMenu trigger (existing pattern)
```typescript
// Source: [VERIFIED: src/client/components/ui/dropdown-menu.tsx]
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" aria-label={t('triage.priorityAriaLabel')}>
      {priority ? t('triage.prioritySet', { priority }) : t('triage.priorityNone')}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={() => triageMutation.mutate({ priority: 'critical' })}>
      <span className="h-1.5 w-1.5 rounded-full bg-destructive mr-2" />
      {t('triage.priority.critical')}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => triageMutation.mutate({ priority: null })}>
      {t('triage.priorityClear')}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Badge component (existing priority pill pattern)
```typescript
// Source: [VERIFIED: badge.tsx — existing 'success', 'muted' variants]
// For priority pills that don't map to existing variants, use className override:
<div className={cn(
  'inline-flex items-center rounded-md px-1.5 py-0 text-[11px] font-semibold h-5',
  PRIORITY_CLASSES[priority]  // Record<string, string> constant defined above
)} />
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Query v4 `useMutation` context | TanStack Query v5 — same `useMutation` API but `onMutate` context type changed | v5 (already in project) | `context` parameter in `onError` is typed — must use `context?.previous` pattern |
| `QueryClient.getQueryData` returns `unknown` | Still returns `unknown` in v5 — must cast | v5 | Cast to known type or use type parameter |
| Radix UI separate packages per primitive | Still separate — no change | — | Each Radix package must be installed separately (all already installed) |

**Deprecated/outdated:**
- React i18n `Trans` component with hardcoded JSX: Not used in this project. Use `t()` with interpolation instead (`{{priority}}`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `issue.repoFullName` is always in `owner/repo` format (never empty) | Pattern 5 | Split produces empty strings → bad query key → API 500 |
| A2 | `queryClient.getQueryData` in parent renders returns live cache for rows that have been opened | Pitfall 3 | Badge never updates in current session |
| A3 | The COALESCE SQL in upsertTriageRecord handles explicit `null` args as SQL NULL (not as the string 'null') | Pitfall 4, Common Pitfalls | Priority clear never works |

**A1 mitigation:** Add guard: `if (!owner || !repo) return` before query.
**A2 mitigation:** Simplest approach — IssueDetailPanel passes triageData up via `onTriageLoad` callback or parent subscribes to same query key.
**A3 verification:** [VERIFIED: triage.ts line `args: [repo, issueNumber, ..., updates.priority !== undefined ? updates.priority : null]` — when `priority: null` is passed from client, args receives JS `null`, Turso client converts to SQL NULL — confirmed behavior for libsql driver]

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (A1 and A2 are low-risk mitigation patterns, not blockers.)

---

## Open Questions

1. **How does parent access triageState for list row badges?**
   - What we know: D-07 says no eager batch fetch. Cache only populated after panel opens.
   - What's unclear: Does parent call `queryClient.getQueryData` on every render, or does IssueDetailPanel pass data up via callback?
   - Recommendation: IssueDetailPanel's internal `useQuery` result is not accessible to the parent without a callback or context. Simplest: add `onTriageLoad?: (triageState: { isTriaged: boolean; priority: string | null }) => void` prop to `IssueDetailPanel`; parent stores per-issue triage state in local `Map<number, TriageState>`. This is clean, testable, and avoids prop drilling complexity.

2. **Should PrioritySelector show "Clear" only when priority is set, or always?**
   - What we know: UI-SPEC says "Clear — shown only when priority is currently set".
   - What's unclear: Loading state — what happens when `triageData` is undefined (loading)?
   - Recommendation: Treat loading state as no priority (don't show Clear). Disable both controls during mutation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely UI + existing API integration. No new external tools, CLIs, runtimes, or services beyond what the project already uses. The triage API routes and DB were created in Phase 1 and are confirmed operational (Phase 1 is complete per STATE.md).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `apps/web/vite.config.ts` (inferred from Vite setup) |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-01 | TriagedToggle renders unchecked; click calls mutation with `{isTriaged: true}` | unit | `cd apps/web && npx vitest run src/client/components/IssueDetailPanel.test.tsx` | ❌ Wave 0 |
| TRIAGE-01 | Triaged state renders CheckCircle2 icon (`aria-pressed=true`) | unit | same file | ❌ Wave 0 |
| TRIAGE-02 | PrioritySelector opens dropdown with Critical/High/Medium/Low/Clear | unit | `cd apps/web && npx vitest run src/client/components/IssueDetailPanel.test.tsx` | ❌ Wave 0 |
| TRIAGE-02 | Selecting priority calls mutation with `{priority: 'high'}` | unit | same file | ❌ Wave 0 |
| TRIAGE-03 | Optimistic update sets query cache immediately on mutate | unit | same file | ❌ Wave 0 |
| TRIAGE-03 | Error rollback restores previous cache value | unit | same file | ❌ Wave 0 |
| TRIAGE-04 | TriageBadgeSlot renders checkmark when `triageState.isTriaged=true` | unit | `cd apps/web && npx vitest run src/client/components/IssueListRow.test.tsx` | ✅ (extend) |
| TRIAGE-04 | TriageBadgeSlot renders priority pill when priority set | unit | same file | ✅ (extend) |
| TRIAGE-04 | TriageBadgeSlot renders nothing when no triageState prop | unit | same file | ✅ (extend) |
| TRIAGE-05 | j key moves to next issue when panel is open | unit | `cd apps/web && npx vitest run src/client/components/IssuesView.test.tsx` | ❌ Wave 0 |
| TRIAGE-05 | k key moves to previous issue; boundary: k on first does nothing | unit | same file | ❌ Wave 0 |
| TRIAGE-05 | j/k do nothing when panel is closed | unit | same file | ❌ Wave 0 |
| TRIAGE-05 | j/k do nothing when focus is on INPUT element | unit | same file | ❌ Wave 0 |
| TRIAGE-06 | ClosedIssueWarning renders when issue.state === 'closed' | unit | `cd apps/web && npx vitest run src/client/components/IssueDetailPanel.test.tsx` | ❌ Wave 0 |
| TRIAGE-06 | ClosedIssueWarning not rendered for open issues | unit | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npm test`
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/client/components/IssueDetailPanel.test.tsx` — covers TRIAGE-01, 02, 03, 06 (new file — TriageSection unit tests)
- [ ] `src/client/components/IssuesView.test.tsx` — covers TRIAGE-05 (new file — keyboard nav tests)
- [ ] `src/client/components/IssueListRow.test.tsx` — extend existing file for TRIAGE-04

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Triage API already requires `authenticateRequest` (Phase 1) |
| V3 Session Management | no | JWT session managed in Phase 3; no changes here |
| V4 Access Control | no | `authenticateRequest` on GET + PUT already enforced in triage route |
| V5 Input Validation | yes | `triagePutBodySchema.safeParse(req.body)` already in triage route; UI sends well-typed values |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via issue title in DOM | Tampering | React renders as text nodes (not innerHTML); no dangerouslySetInnerHTML in triage UI |
| CSRF on PUT /api/triage | Tampering | Credentials: 'include' with JWT auth header; no cookie-only auth on mutation endpoints |
| Unauthorized triage read/write | Elevation of Privilege | `authenticateRequest` already enforced on both GET and PUT in triage route |

**No new security surface added.** All API routes were hardened in Phase 1. The UI layer sends typed values and all mutation paths go through the existing auth middleware.

---

## Sources

### Primary (HIGH confidence)
- `apps/web/api/triage/[owner]/[repo]/[number].ts` — confirmed GET + PUT route implementation, auth pattern, body schema
- `apps/web/api/_lib/db/triage.ts` — confirmed TriageRecord type, TriageState discriminated union, upsertTriageRecord SQL
- `apps/web/src/client/components/IssueDetailPanel.tsx` — confirmed component structure and prop interface
- `apps/web/src/client/components/IssueListRow.tsx` — confirmed productBadge optional prop pattern
- `apps/web/src/client/components/IssuesView.tsx` — confirmed useQuery, useEffect, selectedIssueId patterns
- `apps/web/src/client/components/AllIssuesView.tsx` — confirmed same patterns for cross-repo view
- `apps/web/src/client/components/ui/dropdown-menu.tsx` — confirmed DropdownMenu wrapper + all exported components
- `apps/web/src/client/components/ui/badge.tsx` — confirmed CVA variants available
- `apps/web/src/client/components/ui/button.tsx` — confirmed size="sm" = h-8 px-3 text-xs
- `apps/web/src/client/hooks/useToast.ts` — confirmed useToast + useToastStore API
- `apps/web/src/shared/types/github.ts` — confirmed GitHubIssue.repoFullName: string and state: 'open' | 'closed'
- `apps/web/src/shared/i18n/locales/en/issues.json` + `fr/issues.json` — confirmed existing key structure
- `apps/web/src/client/styles/globals.css` — confirmed --success, --warning, --destructive, --muted CSS vars
- `apps/web/package.json` — confirmed @tanstack/react-query ^5.99.2, lucide-react ^0.511.0, all Radix packages

### Secondary (MEDIUM confidence)
- `apps/web/src/client/components/IssueListRow.test.tsx` — established test mock patterns for Vitest
- `apps/web/api/_lib/db/triage.test.ts` — established DB mock pattern
- `apps/web/src/client/components/AllIssuesView.test.tsx` — established view component test pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against package.json
- Architecture: HIGH — existing patterns in IssuesView/AllIssuesView directly inform new code
- Pitfalls: HIGH — derived from reading actual SQL, component props, and COALESCE semantics
- Test patterns: HIGH — existing test files confirm mocking conventions

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable stack; no fast-moving dependencies)
