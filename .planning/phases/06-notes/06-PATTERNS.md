# Phase 6: Notes - Pattern Map

**Mapped:** 2026-04-22
**Files analyzed:** 10
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` | handler | request-response | itself (existing file, needs extension) | exact |
| `apps/web/api/_lib/db/triage.ts` | DB layer | CRUD | itself (existing file, needs extension) | exact |
| `apps/web/src/client/components/ui/textarea.tsx` | UI component | — | `apps/web/src/client/components/ui/input.tsx` | exact |
| `apps/web/src/client/components/IssueDetailPanel.tsx` | component | request-response | itself (existing file, needs extension) | exact |
| `apps/web/src/client/components/IssueDetailPanel.test.tsx` | test | — | itself (existing file, needs extension) | exact |
| `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` | test | — | `apps/web/api/_lib/db/triage.test.ts` | role-match |
| `apps/web/api/_lib/db/triage.test.ts` | test | — | itself (existing file, needs extension) | exact |
| `apps/web/src/shared/i18n/locales/en/issues.json` | i18n | — | itself (existing file, needs extension) | exact |
| `apps/web/src/shared/i18n/locales/fr/issues.json` | i18n | — | itself (existing file, needs extension) | exact |
| `apps/web/scripts/mocks/github-fixtures.ts` | mock | request-response | itself (existing file, needs extension) | exact |

---

## Pattern Assignments

### `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` (handler, request-response — MODIFY)

**Analog:** itself — read the current file in full before modifying.

**Current imports** (lines 1-6):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../../../../../_lib/db/client.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';
import { githubFetch, GITHUB_API } from '../../../../../../_lib/github.js';
import { githubCommentSchema, githubOwnerRepoSchema } from '../../../../../../_lib/validation.js';
```

**Imports to add for D-03/D-04:**
```typescript
import { getUserById } from '../../../../../../_lib/db/users.js';
import { getTriageRecord, upsertTriageRecord } from '../../../../../../_lib/db/triage.js';
```
Remove the `githubFetch` import — the per-user token case uses a raw `fetch()` call instead (see anti-pattern note in RESEARCH.md).

**Current 4-step shape** (lines 8-42) — keep this structure, extend step 3:
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Parse — path params throw (programmer bug → 500); body safeParse (user input → 400)
  const { owner, repo } = githubOwnerRepoSchema.parse(req.query);
  const number = z.string().regex(/^\d+$/).parse(req.query.number as string);
  const bodyResult = githubCommentSchema.safeParse(req.body);
  if (!bodyResult.success) return res.status(400).json({ error: 'Invalid input' });

  // 2. Authorize
  const user = await authenticateRequest(req, res);
  if (!user) return;

  // 3. Pure domain logic — ADD HERE:
  //    a. getUserById(user.userId) → github_token (D-04)
  //    b. getTriageRecord() → check githubCommentId (D-03)
  //    c. raw fetch() with per-user token
  //    d. upsertTriageRecord() → save commentId

  // 4. Respond
}
```

**D-04 per-user token pattern** — add after `authenticateRequest`:
```typescript
// D-04: look up per-user token — do NOT use githubFetch() / GITHUB_TOKEN env var
const dbUser = await getUserById(user.userId);
if (!dbUser?.github_token) {
  return res.status(403).json({ error: 'No GitHub token for user' });
}
```

**D-03 idempotency pattern** — add after per-user token check:
```typescript
// D-03: check for existing comment before calling GitHub
const existing = await getTriageRecord(`${owner}/${repo}`, parseInt(number, 10));
if (existing?.githubCommentId) {
  return res.json({ alreadyPosted: true, commentId: existing.githubCommentId });
}
```

**Raw fetch with per-user token** — replaces current `githubFetch()` call:
```typescript
const response = await fetch(
  `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(number)}/comments`,
  {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${dbUser.github_token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: bodyResult.data.body }),
  }
);
if (!response.ok) {
  return res.status(response.status).json({ error: `GitHub API error: ${response.statusText}` });
}
const comment = await response.json();

// Save idempotency guard after success
await upsertTriageRecord(`${owner}/${repo}`, parseInt(number, 10), {
  githubCommentId: comment.id,
  commentStatus: 'posted',
});
return res.json(comment);
```

**Error handling pattern** — current try/catch (lines 39-41), keep as-is:
```typescript
} catch (error: any) {
  res.status(500).json({ error: 'Internal server error' });
}
```

---

### `apps/web/api/_lib/db/triage.ts` (DB layer, CRUD — MODIFY)

**Analog:** itself — extend `upsertTriageRecord` only. All other functions stay untouched.

**Current `upsertTriageRecord` signature** (lines 49-52):
```typescript
export async function upsertTriageRecord(
  repo: string,
  issueNumber: number,
  updates: { isTriaged?: boolean; priority?: 'critical' | 'high' | 'medium' | 'low' | null }
): Promise<TriageRecord & { triageState: TriageState }>
```

**Extended signature — add `githubCommentId` and `commentStatus`:**
```typescript
export async function upsertTriageRecord(
  repo: string,
  issueNumber: number,
  updates: {
    isTriaged?: boolean;
    priority?: 'critical' | 'high' | 'medium' | 'low' | null;
    githubCommentId?: number | null;
    commentStatus?: 'posted' | 'failed' | null;
  }
): Promise<TriageRecord & { triageState: TriageState }>
```

**SQL extension pattern** — follow the existing conditional expression pattern (lines 64-65) for the new fields. The INSERT column list and ON CONFLICT SET clause both need to include `github_comment_id` and `comment_status`:

Current expressions:
```typescript
const isTriagedExpr = updates.isTriaged !== undefined ? 'excluded.is_triaged' : 'issue_triage.is_triaged';
const priorityExpr = 'priority' in updates ? 'excluded.priority' : 'issue_triage.priority';
```

Add analogously:
```typescript
const commentIdExpr = 'githubCommentId' in updates ? 'excluded.github_comment_id' : 'issue_triage.github_comment_id';
const commentStatusExpr = 'commentStatus' in updates ? 'excluded.comment_status' : 'issue_triage.comment_status';
```

And add `commentIdVal` / `commentStatusVal` for the INSERT args, plus extend the SQL string to include the two new columns.

**Pitfall:** The existing test (`triage.test.ts` line 45) claims 3 execute calls but the real implementation makes only 2 (one atomic `INSERT ON CONFLICT DO UPDATE` + one `SELECT`). New tests for comment fields must mock exactly 2 `mockExecute` calls.

---

### `apps/web/src/client/components/ui/textarea.tsx` (UI component — CREATE NEW)

**Analog:** `apps/web/src/client/components/ui/input.tsx` (exact pattern)

**Input imports and forwardRef pattern** (lines 1-28 of input.tsx):
```typescript
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-200',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

**Textarea adaptation** — swap `<input>` for `<textarea>`, drop `type` prop, drop `file:*` classes, drop `h-10` (textarea grows with `rows`), add `resize-none`:
```typescript
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors duration-200',
          'resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
```

The exact class string is verified against `06-UI-SPEC.md` Component Inventory section.

---

### `apps/web/src/client/components/IssueDetailPanel.tsx` (component — MODIFY)

**Analog:** itself — insert note section following the triage mutation pattern already in the file.

**Existing imports** (lines 1-20) — add `useState` to the React import and add `Textarea` import:
```typescript
import { useEffect, startTransition, useState } from 'react';  // add useState
// ... existing imports ...
import { Textarea } from './ui/textarea';  // new import
```

**Existing `useToast` destructure** (line 49) — add `success`:
```typescript
// Current:
const { error: toastError } = useToast();
// Extend to:
const { error: toastError, success: toastSuccess } = useToast();
```

**Note state variables** — add alongside existing query/mutation declarations:
```typescript
const [noteText, setNoteText] = useState('');
const [sent, setSent] = useState(false);
```

**Note mutation pattern** — follows the `triageMutation` shape (lines 67-98) but simpler (no optimistic update, no cache to roll back):
```typescript
const noteMutation = useMutation({
  mutationFn: async (vars: { body: string; owner: string; repo: string; number: number }) => {
    const res = await authenticatedFetch(
      `/github/repos/${vars.owner}/${vars.repo}/issues/${vars.number}/comment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: vars.body }),
      }
    );
    if (!res.ok) throw new Error('comment post failed');
    return res.json();
  },
  onSuccess: () => {
    setNoteText('');
    setSent(true);
    toastSuccess(t('notes.postSuccess'));
    setTimeout(() => setSent(false), 2000);
  },
  onError: () => {
    // noteText is NOT cleared — user can retry without retyping (D-05)
    toastError(t('notes.postError'));
  },
});
```

**Note section JSX** — insert between the closing `</div>` of TriageSection (line 234) and the first `<div className="border-t border-border" />` (line 237). Insert a new divider + note section block:
```tsx
{/* Note section — D-01: between triage controls and meta divider */}
<div className="border-t border-border" />

<div className="flex flex-col gap-2">
  <label htmlFor="note-textarea" className="text-xs text-muted-foreground">
    {t('notes.sectionLabel')}
  </label>
  <Textarea
    id="note-textarea"
    rows={4}
    placeholder={t('notes.placeholder')}
    value={noteText}
    onChange={(e) => setNoteText(e.target.value)}
    disabled={noteMutation.isPending}
    onKeyDown={(e) => {
      if (e.ctrlKey && e.key === 'Enter' && noteText.trim() && !noteMutation.isPending) {
        noteMutation.mutate({ body: noteText, owner, repo, number: issue.number });
      }
    }}
  />
  <div aria-live="polite" className="flex justify-end">
    <Button
      variant={sent ? 'success' : 'default'}
      size="default"
      disabled={!noteText.trim() || noteMutation.isPending || sent}
      onClick={() => {
        if (!issue) return;
        noteMutation.mutate({ body: noteText, owner, repo, number: issue.number });
      }}
    >
      {sent
        ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />{t('notes.sentButton')}</>
        : t('notes.postButton')
      }
    </Button>
  </div>
</div>
```

`CheckCircle2` is already imported at line 6 of `IssueDetailPanel.tsx`. No new icon import needed.

**Button `success` variant** — already defined in `button.tsx` line 24:
```typescript
success: 'bg-[var(--success)] text-[var(--success-foreground)] hover:bg-[var(--success)]/90 active:scale-[0.98]',
```

---

### `apps/web/src/client/components/IssueDetailPanel.test.tsx` (test — EXTEND)

**Analog:** itself — follow all existing test patterns exactly.

**Mock setup pattern** (lines 1-106) — the `setupMocks` helper and all `vi.mock()` calls must be reused. The note mutation will also be called via `useMutation` — the mock at line 28 already stubs `useMutation` globally. New note tests need to distinguish between the two `useMutation` calls (triage and note) — the current mock returns the same `mutate` for both. New tests that target note-specific mutation behaviour should use `vi.mocked(useMutation).mock.calls` index 1 (the second `useMutation` call).

**i18n mock extension** (lines 6-25) — add the new `notes.*` keys to the `t` function stub:
```typescript
if (key === 'notes.postButton') return 'Post Note';
if (key === 'notes.sentButton') return 'Sent';
if (key === 'notes.sectionLabel') return 'Add a note';
if (key === 'notes.placeholder') return 'Write a note to post as a GitHub comment…';
if (key === 'notes.postSuccess') return 'Note posted to GitHub';
if (key === 'notes.postError') return 'Could not post note. Try again.';
```

**`useToast` mock extension** (lines 40-43) — add `success` to the mock return so NOTES-03 tests can assert on it:
```typescript
// Current:
const mockToastError = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: mockToastError, success: vi.fn() }),
}));
// Extend to expose success for assertions:
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ error: mockToastError, success: mockToastSuccess }),
}));
```

**Add `Textarea` mock** — add alongside existing UI primitive mocks (after line 80):
```typescript
vi.mock('./ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, disabled, onKeyDown, id }: any) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={onKeyDown}
    />
  ),
}));
```

**TDD — write failing tests first** per CLAUDE.md engineering principle 4. New `describe` blocks to add:

```typescript
describe('IssueDetailPanel — NOTES-01: note textarea renders', () => {
  it('renders note textarea with placeholder', () => { /* failing first */ });
  it('Post Note button is disabled when textarea is empty', () => { /* failing first */ });
  it('Post Note button is enabled when textarea has text', () => { /* failing first */ });
  it('calls noteMutation.mutate with correct args on button click', () => { /* failing first */ });
});

describe('IssueDetailPanel — NOTES-03: post feedback', () => {
  it('onSuccess clears textarea and shows success toast', () => { /* failing first */ });
  it('onSuccess shows Sent button state for 2 seconds', () => { /* failing first */ });
  it('onError preserves textarea text and shows error toast', () => { /* failing first */ });
});
```

---

### `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` (test — CREATE NEW)

**Analog:** `apps/web/api/_lib/db/triage.test.ts` (api handler test pattern)

**Mock setup pattern** (triage.test.ts lines 1-9) — adapt for the comment handler:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB dependencies before importing handler
const mockExecute = vi.fn();
vi.mock('../../../../../../_lib/db/client.js', () => ({
  ensureDb: vi.fn().mockResolvedValue(undefined),
  getClient: () => ({ execute: mockExecute }),
}));
vi.mock('../../../../../../_lib/db/users.js', () => ({
  getUserById: vi.fn(),
}));
vi.mock('../../../../../../_lib/db/triage.js', () => ({
  getTriageRecord: vi.fn(),
  upsertTriageRecord: vi.fn(),
}));
vi.mock('../../../../../../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn(),
}));

import handler from './comment.js';
import { getUserById } from '../../../../../../_lib/db/users.js';
import { getTriageRecord, upsertTriageRecord } from '../../../../../../_lib/db/triage.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';
```

**Vercel req/res mock helper** — copy from `api/auth/github/callback.test.ts` (not read, but standard pattern for this codebase):
```typescript
function mockVercelReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    query: { owner: 'org', repo: 'repo', number: '42' },
    headers: { authorization: 'Bearer valid-token' },
    body: { body: 'This is a note.' },
    ...overrides,
  } as unknown as import('@vercel/node').VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return {
    res: { json, status } as unknown as import('@vercel/node').VercelResponse,
    json,
    status,
  };
}
```

**Test cases to cover** (TDD — write each test before the corresponding implementation):

```typescript
describe('comment.ts — NOTES-01: valid POST', () => {
  it('calls GitHub API and returns comment on valid input', async () => { /* failing first */ });
  it('returns 400 when body is empty string', async () => { /* failing first */ });
  it('returns 405 on GET request', async () => { /* failing first */ });
  it('returns 401 when no auth token', async () => { /* failing first */ });
});

describe('comment.ts — D-04: per-user token', () => {
  it('returns 403 when user has no github_token', async () => { /* failing first */ });
  it('uses dbUser.github_token in Authorization header (not GITHUB_TOKEN env var)', async () => { /* failing first */ });
});

describe('comment.ts — NOTES-02: idempotency', () => {
  it('returns { alreadyPosted: true, commentId } when github_comment_id already set', async () => { /* failing first */ });
  it('does NOT call GitHub API when already posted', async () => { /* failing first */ });
  it('saves githubCommentId to triage record after successful GitHub post', async () => { /* failing first */ });
});
```

**Execute mock count for triage:** When testing `upsertTriageRecord` interaction (NOTES-02 save), mock exactly 2 `mockExecute` calls (1 INSERT ON CONFLICT + 1 SELECT) — see triage.test.ts pitfall note.

---

### `apps/web/api/_lib/db/triage.test.ts` (test — EXTEND)

**Analog:** itself — add one new `describe` block following the existing pattern at lines 42-75.

**Existing mock setup** — already in place at lines 1-9, no changes needed.

**New describe block to add** (TDD — failing test first):
```typescript
describe('upsertTriageRecord — NOTES-02: comment fields', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('saves githubCommentId and commentStatus to triage record', async () => {
    // 2 execute calls: INSERT ON CONFLICT DO UPDATE + SELECT
    mockExecute.mockResolvedValueOnce({}); // INSERT
    mockExecute.mockResolvedValueOnce({   // SELECT
      rows: [{
        github_repo: 'owner/repo',
        github_issue_number: 42,
        is_triaged: 0,
        priority: null,
        github_comment_id: 123456,
        comment_status: 'posted',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-02T00:00:00',
      }],
    });
    const result = await upsertTriageRecord('owner/repo', 42, {
      githubCommentId: 123456,
      commentStatus: 'posted',
    });
    expect(result.githubCommentId).toBe(123456);
    expect(result.commentStatus).toBe('posted');
    // Verify SQL includes github_comment_id
    expect(mockExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sql: expect.stringContaining('github_comment_id'),
    }));
  });
});
```

---

### `apps/web/src/shared/i18n/locales/en/issues.json` (i18n — EXTEND)

**Analog:** itself — append `notes` key at the same level as `triage` (line 64 of existing file).

**Current structure ends at** line 81 (closing `}` of `triage`). Add after the `triage` block, before the final `}`:
```json
"notes": {
  "sectionLabel": "Add a note",
  "placeholder": "Write a note to post as a GitHub comment…",
  "postButton": "Post Note",
  "sentButton": "Sent",
  "postSuccess": "Note posted to GitHub",
  "postError": "Could not post note. Try again."
}
```

---

### `apps/web/src/shared/i18n/locales/fr/issues.json` (i18n — EXTEND)

**Analog:** itself — same structure as English, same level as `triage` (line 64 of existing file).

```json
"notes": {
  "sectionLabel": "Ajouter une note",
  "placeholder": "Rédigez une note à publier en tant que commentaire GitHub…",
  "postButton": "Publier la note",
  "sentButton": "Envoyé",
  "postSuccess": "Note publiée sur GitHub",
  "postError": "Impossible de publier la note. Réessayez."
}
```

---

### `apps/web/scripts/mocks/github-fixtures.ts` (mock — EXTEND)

**Analog:** itself — add one new route inside `registerMockRoutes()` following the existing async route pattern (lines 115-185).

**Import to add** at top of file (alongside existing imports, line 5):
```typescript
import { upsertTriageRecord } from '../../api/_lib/db/triage.js';
```
(This import already exists as `getTriageRecordsBatch` — add `upsertTriageRecord` to the same import.)

**New route** — add inside `registerMockRoutes()` after the existing triage GET mock (after line 185):
```typescript
// Mock POST comment — returns fake comment object and saves idempotency guard to dev.db
app.post(
  '/api/github/repos/:owner/:repo/issues/:number/comment',
  async (req: Request, res: Response) => {
    try {
      await ensureDb();
      const { owner, repo, number } = req.params;
      const { body } = req.body as { body: string };
      const commentId = Date.now();
      const repoFull = `${owner}/${repo}`;
      const issueNumber = parseInt(number, 10);
      await upsertTriageRecord(repoFull, issueNumber, {
        githubCommentId: commentId,
        commentStatus: 'posted',
      });
      res.json({
        id: commentId,
        html_url: `https://github.com/${owner}/${repo}/issues/${number}#issuecomment-${commentId}`,
        body,
      });
    } catch (err) {
      console.error('[mock] comment post error:', err);
      res.status(500).json({ error: 'Mock comment error' });
    }
  }
);
```

**Pattern match:** This exactly mirrors the `POST /api/auth/github/callback` mock pattern (lines 115-133): async handler, `ensureDb()`, `try/catch`, `console.error` on failure.

---

## Shared Patterns

### Authentication (apply to `comment.ts`)

**Source:** `apps/web/api/_lib/auth/middleware.ts` lines 11-28

```typescript
// authenticateRequest returns TokenPayload | null — always null-check before proceeding
const user = await authenticateRequest(req, res);
if (!user) return;  // response already sent by authenticateRequest
// user.userId is the string UUID for DB lookups
```

### 4-Step Handler Shape (apply to `comment.ts`)

**Source:** `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` lines 8-42 (current shape, to be preserved and extended)

Order is mandatory per CLAUDE.md:
1. Parse (path params: `z.parse` → 500; body: `safeParse` → 400)
2. Authorize (`authenticateRequest`)
3. Pure domain logic (DB reads, GitHub API call, DB write)
4. Respond (`res.json`)

### useMutation Pattern (apply to `IssueDetailPanel.tsx` note mutation)

**Source:** `apps/web/src/client/components/IssueDetailPanel.tsx` lines 67-98 (triageMutation)

Key points:
- `mutationFn` receives all needed vars (owner, repo, number) — no stale closure capture
- `onError` calls `toastError()` — pass translated string via `t()`
- Note mutation has NO `onMutate`/rollback — there is no cache to roll back
- `authenticatedFetch` is the fetch wrapper (not raw `fetch`) on the client side

### Error Toast Pattern (apply to `IssueDetailPanel.tsx` note `onError`)

**Source:** `apps/web/src/client/hooks/useToast.ts` lines 38-53 and `IssueDetailPanel.tsx` line 49

```typescript
// Destructure from useToast():
const { error: toastError, success: toastSuccess } = useToast();

// Call in onError:
toastError(t('notes.postError'));        // string title directly

// Call in onSuccess:
toastSuccess(t('notes.postSuccess'));    // same API
```

`toastSuccess` is the `success` convenience method — wraps `addToast({ type: 'success', title })`.

### DB Mock Pattern for API Tests (apply to `comment.test.ts`)

**Source:** `apps/web/api/_lib/db/triage.test.ts` lines 1-9

```typescript
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));
```

For `comment.test.ts`, the mock path will be relative to the handler file location:
```typescript
vi.mock('../../../../../../_lib/db/client.js', () => ({
  ensureDb: vi.fn().mockResolvedValue(undefined),
  getClient: () => ({ execute: mockExecute }),
}));
```

### Zod Validation at DB Boundary (apply to `triage.ts` extension)

**Source:** `apps/web/api/_lib/db/triage.ts` lines 20-38 (`rowToTriage`)

```typescript
// DB boundary: always use z.parse() (not safeParse) — programmer bug → throws ZodError → 500
const parsed = triageDbRowSchema.parse(row);
```

The `triageDbRowSchema` in `validation.ts` (lines 199-208) already includes `github_comment_id` and `comment_status` — no schema changes needed, only the SQL and function signature.

---

## No Analog Found

All 10 files have analogs or are existing files being extended. No files require fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `apps/web/api/`, `apps/web/src/client/`, `apps/web/src/shared/`, `apps/web/scripts/mocks/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-04-22
