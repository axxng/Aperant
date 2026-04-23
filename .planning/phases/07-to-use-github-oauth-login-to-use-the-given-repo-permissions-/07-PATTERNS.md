# Phase 7: Promote to Backlog - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/api/tasks/by-github-issue.ts` | handler | request-response | `apps/web/api/tasks/index.ts` (GET case) | exact |
| `apps/web/api/tasks/by-github-issue.test.ts` | test | — | `apps/web/api/_lib/db/triage.test.ts` | role-match |
| `apps/web/api/tasks/index.ts` (MODIFY) | handler | CRUD | self (add 409 catch to POST case) | self |
| `apps/web/src/client/components/IssueDetailPanel.tsx` (MODIFY) | component | request-response | self (add 3rd mutation + useQuery) | self |
| `apps/web/src/client/components/IssueDetailPanel.test.tsx` (MODIFY) | test | — | self (extend with promote describe blocks, fix % 3) | self |
| `apps/web/src/shared/i18n/locales/en/issues.json` (MODIFY) | config | — | existing `notes` namespace in same file | exact |
| `apps/web/src/shared/i18n/locales/fr/issues.json` (MODIFY) | config | — | existing `notes` namespace in same file | exact |

---

## Pattern Assignments

### `apps/web/api/tasks/by-github-issue.ts` (handler, request-response)

**Analog:** `apps/web/api/tasks/index.ts` (GET case, lines 13-28)

**Imports pattern** (from `apps/web/api/tasks/index.ts`, lines 1-7):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';
import { getTaskByGitHubIssue } from '../_lib/db/tasks.js';
```

**4-step handler shape** (from `apps/web/api/tasks/index.ts`, lines 9-28):
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Parse — path params/query strings: z.parse() throws ZodError → 500 (programmer bug)
  const repo = z.string().regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/).parse(req.query.repo as string);
  const number = z.coerce.number().int().positive().parse(req.query.number as string);

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;
  if (!hasRole(user, 'admin', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 3. DB call
  const task = await getTaskByGitHubIssue(repo, number);

  // 4. Respond
  return res.json(task ?? null);
}
```

**Key rule:** Query string params (`repo`, `number`) are path-level parameters — use `z.parse()` (throws ZodError → 500), NOT `z.safeParse()` (which would return 400, reserved for user-submitted body). See CLAUDE.md engineering principle D-02.

---

### `apps/web/api/tasks/by-github-issue.test.ts` (test)

**Analog:** `apps/web/api/_lib/db/triage.test.ts` (lines 1-10) and `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` (lines 1-23)

**Test file header + mock setup** (from `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts`, lines 1-23):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './by-github-issue.js';

vi.mock('../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'user-1' }),
  hasRole: vi.fn().mockReturnValue(true),
}));
vi.mock('../_lib/db/tasks.js', () => ({
  getTaskByGitHubIssue: vi.fn(),
}));

import { getTaskByGitHubIssue } from '../_lib/db/tasks.js';

function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: { repo: 'org/repo', number: '42' },
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as VercelResponse, json, status };
}
```

**Test cases to cover (TDD Wave 0 — write failing stubs):**
- Returns task when `getTaskByGitHubIssue` resolves to a task
- Returns `null` when `getTaskByGitHubIssue` resolves to `null`
- Returns 405 when method is not GET
- Returns 403 when `hasRole` is false

---

### `apps/web/api/tasks/index.ts` (MODIFY — add 409 catch to POST case)

**File:** `apps/web/api/tasks/index.ts`

**Current POST block** (lines 30-47) must have its DB call wrapped in try/catch:

```typescript
// BEFORE (lines 42-46):
const task = await createTask(result.data);
await broadcastEvent('task_created', task);
return res.status(201).json(task);

// AFTER — add 409 catch around createTask():
try {
  const task = await createTask(result.data);
  await broadcastEvent('task_created', task);
  return res.status(201).json(task);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('UNIQUE constraint failed')) {
    // Return existing task so client can show "View in Backlog" badge
    const existing = await getTaskByGitHubIssue(
      result.data.githubRepo!,
      result.data.githubIssueNumber!
    );
    return res.status(409).json({
      error: 'This issue is already in the backlog.',
      existingTask: existing,
    });
  }
  throw err;
}
```

**Additional import** needed at top of file (line 5):
```typescript
import { getAllTasks, getTasksByProduct, createTask, getTaskByGitHubIssue } from '../_lib/db/tasks.js';
```

**Constraint error message note (Pitfall 2 from RESEARCH.md):** SQLite standard message is `"UNIQUE constraint failed: tasks.github_repo, tasks.github_issue_number"`. The `includes('UNIQUE constraint failed')` check is robust. As fallback, also check `(err as any)?.code === 'SQLITE_CONSTRAINT_UNIQUE'`.

---

### `apps/web/src/client/components/IssueDetailPanel.tsx` (MODIFY)

**Analog:** Self — existing `triageMutation` (lines 68-99) and `noteMutation` (lines 106-129) patterns to follow for the new `promoteMutation`.

**New import additions** (merge into existing line 6 imports):
```typescript
import { BookmarkPlus } from 'lucide-react';
```

**New prop** (add to `IssueDetailPanelProps` interface, lines 31-41):
```typescript
interface IssueDetailPanelProps {
  issue: GitHubIssue | null;
  isOpen: boolean;
  onTriageLoad?: (issueId: number, triageState: { isTriaged: boolean; priority: string | null }) => void;
  onClose?: () => void;
  productId: string;  // NEW — required for task creation and "View in Backlog" link
}
```

**New useQuery for already-promoted state** (add after the existing `triageData` useQuery, after line 64):
```typescript
const { data: existingTask } = useQuery({
  queryKey: ['task-by-github-issue', issue?.repoFullName, issue?.number],
  queryFn: async () => {
    if (!issue?.repoFullName || !issue?.number) return null;
    const res = await authenticatedFetch(
      `/tasks/by-github-issue?repo=${encodeURIComponent(issue.repoFullName)}&number=${issue.number}`
    );
    if (!res.ok) return null;
    return res.json();
  },
  enabled: Boolean(issue?.repoFullName && issue?.number),
  staleTime: 0,
});
```

**Pure mapping function** (add before the component, exported for unit testing):
```typescript
// === Pure domain logic ===

export function triagePriorityToTaskPriority(
  triage: 'critical' | 'high' | 'medium' | 'low' | null
): 'low' | 'medium' | 'high' | 'urgent' | undefined {
  if (!triage) return undefined;
  if (triage === 'critical') return 'urgent';
  return triage; // 'high' | 'medium' | 'low' match directly
}
```

**New promoteMutation** (add after `noteMutation`, after line 129 — following same pattern as `noteMutation` lines 106-129):
```typescript
const promoteMutation = useMutation({
  mutationFn: async (vars: {
    productId: string;
    title: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    githubIssueNumber: number;
    githubIssueUrl: string;
    githubRepo: string;
  }) => {
    const res = await authenticatedFetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vars, status: 'backlog', description: '' }),
    });
    if (res.status === 409) {
      const body = await res.json();
      return { alreadyExists: true as const, existingTask: body.existingTask };
    }
    if (!res.ok) throw new Error('promote failed');
    return res.json();
  },
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['task-by-github-issue', issue?.repoFullName, issue?.number] });
    if ('alreadyExists' in data && data.alreadyExists) {
      toastError(t('promote.duplicateToast'));
    } else {
      toastSuccess(t('promote.successToast'));
    }
  },
  onError: () => {
    toastError(t('promote.errorToast'));
  },
});
```

**handlePromote helper** (add after promoteMutation definition):
```typescript
function handlePromote() {
  if (!issue) return;
  promoteMutation.mutate({
    productId,
    title: issue.title,
    priority: triagePriorityToTaskPriority(
      (triageData?.priority as 'critical' | 'high' | 'medium' | 'low' | null) ?? null
    ),
    githubIssueNumber: issue.number,
    githubIssueUrl: issue.htmlUrl,
    githubRepo: issue.repoFullName,
  });
}
```

**Conditional render** (add in JSX, after the "View on GitHub" button block, before or after the Divider following it):
```tsx
{existingTask ? (
  <Badge variant="success" className="cursor-pointer gap-1 text-xs" asChild>
    <a href={`/products/${productId}`}>
      <ExternalLink className="h-3 w-3" />
      {t('promote.viewInBacklog')}
    </a>
  </Badge>
) : (
  <Button
    variant="default"
    size="sm"
    disabled={promoteMutation.isPending}
    aria-label={t('promote.ariaLabel')}
    aria-busy={promoteMutation.isPending}
    aria-disabled={promoteMutation.isPending}
    onClick={handlePromote}
  >
    <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
    {t('promote.promoteButton')}
  </Button>
)}
```

---

### `apps/web/src/client/components/IssueDetailPanel.test.tsx` (MODIFY)

**Analog:** Self — existing `setupNoteMocks` function (lines 246-271) must be updated and new describe blocks added.

**Critical fix — update `setupNoteMocks` from `% 2` to `% 3`** (lines 260-270):
```typescript
// BEFORE (lines 259-270):
let callCount = 0;
vi.mocked(useMutation).mockImplementation((options: any) => {
  callCount++;
  if (callCount % 2 === 1) {
    return { mutate: triageMutate, isPending: false } as any;
  }
  noteMutationOptionsRef = options;
  return { mutate: noteMutate, isPending: false } as any;
});

// AFTER — 3 mutations: triage, note, promote:
const promoteMutate = vi.fn();
let callCount = 0;
vi.mocked(useMutation).mockImplementation((options: any) => {
  callCount++;
  if (callCount % 3 === 1) return { mutate: triageMutate, isPending: false } as any;
  if (callCount % 3 === 2) {
    noteMutationOptionsRef = options;
    return { mutate: noteMutate, isPending: false } as any;
  }
  promoteMutationOptionsRef = options;
  return { mutate: promoteMutate, isPending: false } as any;
});
return { triageMutate, noteMutate, promoteMutate, mockQueryClient };
```

**Also update `setupMocks`** (lines 114-126) — used by triage tests, also needs a 3rd mock return. Since `setupMocks` uses `vi.mocked(useMutation).mockReturnValue(...)` (single value for all calls), triage tests that only check the first mutation will still work. However, if `useQuery` is also called 2 times per render (triage + task-by-github-issue), `useQuery` mock also needs to handle 2 calls:
```typescript
// In setupMocks — mock useQuery to return triageData for triage query, null for task-by-github-issue query
vi.mocked(useQuery).mockImplementation(({ queryKey }: any) => {
  if (queryKey[0] === 'triage') return { data: triageData, isLoading: false, isError: false } as any;
  return { data: null, isLoading: false, isError: false } as any;
});
```

**New i18n mock entries** (add to `useTranslation` mock, lines 7-30):
```typescript
if (key === 'promote.promoteButton') return 'Promote to Backlog';
if (key === 'promote.viewInBacklog') return 'View in Backlog';
if (key === 'promote.ariaLabel') return 'Promote issue to backlog';
if (key === 'promote.successToast') return 'Issue promoted to backlog';
if (key === 'promote.duplicateToast') return 'Issue is already in the backlog';
if (key === 'promote.errorToast') return 'Could not promote issue. Try again.';
```

**New lucide-react mock entry** (add to vi.mock, line 53-59):
```typescript
BookmarkPlus: () => <svg data-testid="bookmark-plus" />,
```

**New describe blocks to add** (Wave 0 RED stubs):
```typescript
let promoteMutationOptionsRef: any = null;

describe('IssueDetailPanel — PROMOTE-01: promote button fires POST /api/tasks', () => {
  it('renders Promote to Backlog button when no existing task', () => {
    setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} productId="prod-uuid-1" />);
    expect(screen.getByLabelText('Promote issue to backlog')).toBeInTheDocument();
  });

  it('calls promoteMutation.mutate with correct fields on button click', () => {
    const { promoteMutate } = setupNoteMocks({ isTriaged: false, priority: null });
    render(<IssueDetailPanel issue={baseIssue} isOpen={true} productId="prod-uuid-1" />);
    fireEvent.click(screen.getByLabelText('Promote issue to backlog'));
    expect(promoteMutate).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'prod-uuid-1',
      title: 'Fix login bug',
      githubIssueNumber: 42,
      githubRepo: 'org/repo',
      status: undefined, // promote handler adds 'backlog'
    }));
  });
});

describe('IssueDetailPanel — PROMOTE-03: badge renders when already promoted', () => {
  it('renders View in Backlog badge when existingTask query returns a task', () => {
    // useQuery mock must return task for 'task-by-github-issue' key
    // ...
  });

  it('does not render promote button when existingTask exists', () => {
    // ...
  });
});

describe('IssueDetailPanel — PROMOTE-04: triage priority pre-populates task priority', () => {
  it('maps triage "critical" to task priority "urgent"', () => {
    // Unit test triagePriorityToTaskPriority directly — exported pure function
    // import { triagePriorityToTaskPriority } from './IssueDetailPanel';
    // expect(triagePriorityToTaskPriority('critical')).toBe('urgent');
  });

  it('maps triage "high" to task priority "high"', () => { /* ... */ });
  it('maps null triage priority to undefined task priority', () => { /* ... */ });
});

describe('IssueDetailPanel — PROMOTE-05: duplicate issue shows toast + badge', () => {
  it('shows duplicate toast when promote returns 409', () => {
    // promoteMutation onSuccess with alreadyExists=true fires toastError
  });
});
```

---

### `apps/web/src/shared/i18n/locales/en/issues.json` (MODIFY)

**Analog:** `"notes"` namespace in same file (lines 82-89) — follow same key structure.

**Add `"promote"` namespace** after `"notes"` closing brace (before final `}`):
```json
"promote": {
  "promoteButton": "Promote to Backlog",
  "viewInBacklog": "View in Backlog",
  "ariaLabel": "Promote issue to backlog",
  "successToast": "Issue promoted to backlog",
  "duplicateToast": "Issue is already in the backlog",
  "errorToast": "Could not promote issue. Try again."
}
```

---

### `apps/web/src/shared/i18n/locales/fr/issues.json` (MODIFY)

**Analog:** `"notes"` namespace in same file (lines 82-89) — parallel structure to EN file.

**Add `"promote"` namespace** after `"notes"` closing brace (before final `}`):
```json
"promote": {
  "promoteButton": "Promouvoir dans le backlog",
  "viewInBacklog": "Voir dans le backlog",
  "ariaLabel": "Promouvoir l'issue dans le backlog",
  "successToast": "Issue promue dans le backlog",
  "duplicateToast": "Cette issue est déjà dans le backlog",
  "errorToast": "Impossible de promouvoir l'issue. Réessayez."
}
```

---

## Shared Patterns

### Authentication (all new API handlers)
**Source:** `apps/web/api/tasks/index.ts` lines 19-23
**Apply to:** `by-github-issue.ts`
```typescript
const user = await authenticateRequest(req, res);
if (!user) return;
if (!hasRole(user, 'admin', 'member')) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

### 4-Step Handler Shape (all new API handlers)
**Source:** `apps/web/api/tasks/index.ts` lines 9-52
**Apply to:** `by-github-issue.ts`

Order is non-negotiable per CLAUDE.md engineering principle:
1. Parse input (`z.parse()` for query params → ZodError → 500; `z.safeParse()` for body → 400)
2. Authorize (`authenticateRequest` + `hasRole`)
3. Call pure domain function(s)
4. Respond

### API Test Mock Boilerplate
**Source:** `apps/web/api/github/repos/[owner]/[repo]/issues.test.ts` lines 11-23
**Apply to:** `by-github-issue.test.ts`
```typescript
function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'GET', query: { ... }, ...overrides } as unknown as VercelRequest;
}
function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as VercelResponse, json, status };
}
```

### DB Mock Pattern
**Source:** `apps/web/api/_lib/db/triage.test.ts` lines 1-10
**Apply to:** `by-github-issue.test.ts` (when testing handler that calls `getTaskByGitHubIssue` directly)
```typescript
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));
```

### useMutation Pattern (3 mutations per render after Phase 7)
**Source:** `apps/web/src/client/components/IssueDetailPanel.tsx` lines 68-129
**Apply to:** `IssueDetailPanel.tsx` (new `promoteMutation`)

All three mutations follow the same shape: `mutationFn` with explicit vars typing, `onSuccess`/`onError` callbacks, `queryClient.invalidateQueries` on success.

### i18n Key Structure
**Source:** `apps/web/src/shared/i18n/locales/en/issues.json` lines 82-89
**Apply to:** Both locale files — add `"promote"` namespace with same keys; EN first, FR in same commit.

---

## No Analog Found

All files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `apps/web/api/`, `apps/web/src/client/components/`, `apps/web/src/shared/i18n/`
**Files scanned:** 12
**Pattern extraction date:** 2026-04-22
