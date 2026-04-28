# Phase 6: Notes - Research

**Researched:** 2026-04-22
**Domain:** Idempotent GitHub comment posting — server-side guard, per-user OAuth token, TanStack Query mutation, Textarea UI component
**Confidence:** HIGH

## Summary

Phase 6 adds a note-posting capability to `IssueDetailPanel`: users write a note, click "Post Note", and it is posted as a GitHub comment on the linked issue. The server-side idempotency guard in `comment.ts` prevents duplicate comments on retry. The panel inserts a new note section between the triage controls and the meta divider.

All foundational assets for this phase are already present in the codebase. The triage mutation in `IssueDetailPanel.tsx` is the exact pattern to replicate for note posting. The `upsertTriageRecord()` function accepts `githubCommentId` and `commentStatus` fields — it needs a targeted extension to save those fields without disturbing `isTriaged`/`priority`. The `githubFetch()` utility currently uses the shared `GITHUB_TOKEN` env var; `comment.ts` must switch to a per-user token loaded from the DB via `getUserById`.

One new UI component is required (`Textarea`), and one new mock route must be registered in `github-fixtures.ts`. No DB migrations are needed — `github_comment_id` and `comment_status` columns already exist in the `issue_triage` table from the Phase 1 migration.

**Primary recommendation:** Extend `upsertTriageRecord()` to accept comment fields, fix `comment.ts` to use the per-user token and add the idempotency check, create the `Textarea` component following the `Input` pattern, and insert the note section in `IssueDetailPanel` following the triage mutation pattern exactly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Note textarea section sits between triage controls and meta section (labels/assignees/date), above the markdown body.
- **D-02:** Note body is ephemeral only — NOT stored in Currents DB. Textarea clears after post. No new DB column required.
- **D-03:** Server-side idempotency in `comment.ts`: check `github_comment_id` before calling GitHub API; if set, return `{ alreadyPosted: true, commentId }` without posting again.
- **D-04:** `comment.ts` must use the authenticated user's `github_token` from the DB (via `user.userId` after `authenticateRequest`), not the global `GITHUB_TOKEN` env var.
- **D-05:** On success: textarea clears, button shows "Sent" + CheckCircle2 for ~2s, then resets. Success toast: "Note posted to GitHub". On failure: toast "Could not post note. Try again." + textarea preserves text.
- **D-06:** Note body must be non-empty (client-side: disable button when empty; server-side: `githubCommentSchema` already validates `body` is non-empty).

### Claude's Discretion

- Exact textarea row height (3–5 rows is reasonable)
- Whether the note section uses a labelled heading or is unlabelled
- Exact toast wording for success
- Whether `Sent` is implemented via a `useState` timer or `useMutation.isSuccess`

### Deferred Ideas (OUT OF SCOPE)

- Displaying the full comment thread in the panel (NOTES-V2-01)
- Editing or deleting a posted note
- Per-user comment attribution in the panel
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTES-01 | User can write and post a note on an issue that is added as a comment on the linked GitHub issue | New note section in `IssueDetailPanel`, `comment.ts` POST route, `authenticatedFetch` mutation |
| NOTES-02 | Posting the same note twice does not create a duplicate GitHub comment | Server-side `github_comment_id` check in `comment.ts` before calling GitHub API; `upsertTriageRecord` saves comment ID after posting |
| NOTES-03 | User sees success or failure feedback after posting a note | `useToast` success/error calls in `onSuccess`/`onError` mutation callbacks; "Sent" button state |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Note textarea + button UI | Browser / Client | — | Ephemeral UI state; React `useState` owns noteText |
| Note posting mutation | Browser / Client | API / Backend | `useMutation` fires POST to `/api/github/repos/.../comment` |
| Idempotency guard | API / Backend | Database / Storage | `comment.ts` reads `issue_triage` before calling GitHub |
| Per-user token resolution | API / Backend | Database / Storage | `getUserById(user.userId).github_token` |
| GitHub comment creation | API / Backend | — | `githubFetch` with per-user token |
| Comment ID persistence | Database / Storage | — | `upsertTriageRecord` writes `github_comment_id` + `comment_status` |
| Success/failure feedback | Browser / Client | — | `useToast` + local `useState` timer for button state |

---

## Standard Stack

### Core (all verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query (`@tanstack/react-query`) | v5 (in use) | `useMutation` for note POST | Already used for triage mutation in same file |
| `react-i18next` | in use | All UI text | Project-wide i18n requirement |
| `lucide-react` | ^0.511.0 | `CheckCircle2` icon in "Sent" state | Already imported in `IssueDetailPanel` |
| Zod | in use | Schema validation at parse boundary | `githubCommentSchema` already validates body |
| `authenticatedFetch` | local | POST comment with JWT | Same pattern as triage PUT mutation |
| `useToast` | local | Success/error feedback | Already imported in `IssueDetailPanel` |

[VERIFIED: source file inspection]

### No New Dependencies

No new npm packages are required for this phase. All capabilities come from existing project dependencies.

---

## Architecture Patterns

### System Architecture Diagram

```
User types in Textarea
        │
        ▼
"Post Note" button clicked
        │
        ▼
useMutation.mutationFn
  authenticatedFetch POST /api/github/repos/{owner}/{repo}/issues/{number}/comment
  { body: noteText }
        │
        ▼
comment.ts handler (4-step shape)
  1. Parse: githubOwnerRepoSchema + number regex + githubCommentSchema.safeParse(body)
  2. Authorize: authenticateRequest → user.userId
  3. Pure domain:
     a. getUserById(user.userId) → github_token (or 403 if null)
     b. getTriageRecord(repo, number) → check github_comment_id
        → if set: return { alreadyPosted: true, commentId }
        → if null: inline fetch to GitHub API with per-user token
                   → upsertTriageRecord(repo, number, { githubCommentId, commentStatus: 'posted' })
                   → return { id, html_url, ... }
  4. Respond: res.json(result)
        │
        ▼
onSuccess → textarea clears, "Sent" state (2s), success toast
onError   → textarea preserves text, error toast
```

### Recommended Project Structure (additions only)

```
apps/web/
├── src/client/components/
│   ├── ui/
│   │   └── textarea.tsx              # NEW — follows Input component pattern
│   └── IssueDetailPanel.tsx          # MODIFY — add note section + useMutation
├── src/shared/i18n/locales/
│   ├── en/issues.json                # MODIFY — add notes.* keys
│   └── fr/issues.json                # MODIFY — add notes.* keys (French)
├── api/
│   ├── _lib/db/triage.ts             # MODIFY — extend upsertTriageRecord
│   └── github/repos/[owner]/[repo]/issues/[number]/
│       └── comment.ts                # MODIFY — idempotency guard + per-user token
└── scripts/mocks/github-fixtures.ts  # MODIFY — add POST comment mock route
```

### Pattern 1: Textarea Component (follows Input pattern)

**What:** A `React.forwardRef` textarea styled identically to `Input`, with `resize-none` and `rows` prop.
**When to use:** Multi-line text input in any panel.

```typescript
// Source: apps/web/src/client/components/ui/input.tsx (pattern)
// New file: apps/web/src/client/components/ui/textarea.tsx
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

[VERIFIED: input.tsx source inspection, UI-SPEC.md]

### Pattern 2: Note useMutation (follows triage mutation pattern)

**What:** TanStack Query `useMutation` for the comment POST — minimal, no optimistic update needed (no cache to update).
**When to use:** Any mutation that posts to GitHub and provides feedback via toast.

```typescript
// Source: IssueDetailPanel.tsx triage mutation pattern
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
    toast({ type: 'success', title: t('notes.postSuccess') });
    setTimeout(() => setSent(false), 2000);
  },
  onError: () => {
    // noteText preserved — no setState call on error
    toastError(t('notes.postError'));
  },
});
```

[VERIFIED: IssueDetailPanel.tsx triage mutation source inspection]

### Pattern 3: Idempotency Guard in comment.ts (4-step shape)

**What:** Server checks `github_comment_id` in `issue_triage` before calling GitHub. If already posted, returns early with `{ alreadyPosted: true, commentId }`.

```typescript
// Step 3 (pure domain logic) in comment.ts:
const user = await authenticateRequest(req, res);
if (!user) return;

// Per-user token (D-04)
const dbUser = await getUserById(user.userId);
if (!dbUser?.github_token) {
  return res.status(403).json({ error: 'No GitHub token for user' });
}

// Idempotency check (D-03)
const existing = await getTriageRecord(`${owner}/${repo}`, parseInt(number, 10));
if (existing?.githubCommentId) {
  return res.json({ alreadyPosted: true, commentId: existing.githubCommentId });
}

// Post to GitHub with per-user token
const response = await fetch(
  `${GITHUB_API}/repos/${owner}/${repo}/issues/${number}/comments`,
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

// Save idempotency guard
await upsertTriageRecord(`${owner}/${repo}`, parseInt(number, 10), {
  githubCommentId: comment.id,
  commentStatus: 'posted',
});

return res.json(comment);
```

[VERIFIED: comment.ts, triage.ts, users.ts source inspection]

### Pattern 4: Extending upsertTriageRecord

**What:** Add `githubCommentId` and `commentStatus` to the updates union type, and conditionally include them in the SQL SET clause.

The existing `upsertTriageRecord` uses a single atomic `INSERT ... ON CONFLICT DO UPDATE SET`. Extend the `updates` parameter type and the SQL expression to include the new fields:

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

SQL addition: include `github_comment_id` and `comment_status` in the INSERT columns and ON CONFLICT SET clause using the same `excluded.github_comment_id` / `issue_triage.github_comment_id` conditional pattern.

[VERIFIED: triage.ts source inspection — existing pattern clearly extensible]

### Pattern 5: Mock Route for Comment POST

**What:** Register `POST /api/github/repos/:owner/:repo/issues/:number/comment` in `github-fixtures.ts` to return a fake comment object.

```typescript
// In registerMockRoutes(), following existing route pattern
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
      // Save idempotency guard to dev.db so the mock matches real behaviour
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

[VERIFIED: github-fixtures.ts source inspection — pattern matches existing triage mock]

### Anti-Patterns to Avoid

- **Using `githubFetch()` directly in `comment.ts` for the per-user token fix:** `githubFetch()` reads `GITHUB_TOKEN` env var — do NOT pass through it. Use a raw `fetch()` call with the per-user token in the Authorization header, or create a thin helper that accepts a token argument. Do not modify `githubFetch()` signature as it would break all callers.
- **Optimistic update for note mutation:** There is no cache entry to update (no GET query for a single note). Do not add `onMutate`/rollback logic — unlike triage, there is nothing to roll back.
- **Storing note text in DB:** D-02 is locked. Do not add columns or store the body.
- **Inline `githubCommentSchema` in comment.ts:** The schema is already in `validation.ts` and imported. Do not duplicate it.
- **Forgetting `upsertTriageRecord` import in comment.ts:** The handler must call `upsertTriageRecord` after GitHub API success. Import it from `_lib/db/triage.js`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-line text input | Custom textarea JSX | `Textarea` component (create once, use everywhere) | Consistent styles, forwardRef support |
| Client-side mutation with loading/error state | Manual `useState` fetch wrapper | `useMutation` from TanStack Query | Handles loading, error, success, retries |
| Toast notifications | Custom notification system | `useToast()` (already in `IssueDetailPanel`) | Already imported, consistent UX |
| JSON body validation | Manual `if (!body)` checks | `githubCommentSchema.safeParse(req.body)` (already in comment.ts) | Already present — do not remove |
| Per-user token lookup | Inline DB query | `getUserById(user.userId)` from `_lib/db/users` | Already exported, handles the lookup |

---

## Common Pitfalls

### Pitfall 1: `githubFetch()` ignores passed token

**What goes wrong:** Developer adds a `token` parameter to `githubFetch()` or tries to override the token via headers, but `githubFetch()` always reads `process.env.GITHUB_TOKEN` and sets `Authorization: Bearer ${token}` — any `Authorization` header passed via `options.headers` is overridden because the function spreads `options.headers` AFTER setting the default, but then the default is set first and `options.headers` comes after in the spread. Actually checking the source: `githubFetch` sets `'Authorization': \`Bearer ${token}\`` first, then `...options.headers` — meaning callers CAN override it. But this is fragile and relies on spread order.

**Why it happens:** The `githubFetch()` helper was designed for the shared PAT. The spread order technically allows override but is not intended usage.

**How to avoid:** For the per-user token use case in `comment.ts`, bypass `githubFetch()` entirely and use a raw `fetch()` call with explicit headers. This is safer and clearer.

**Warning signs:** The `githubFetch()` call in `comment.ts` reads `const token = process.env.GITHUB_TOKEN` at the top — if this remains unchanged, comments are still posted as the shared token.

[VERIFIED: github.ts source inspection]

### Pitfall 2: `upsertTriageRecord` test expectations are stale

**What goes wrong:** The test in `triage.test.ts` expects 3 execute calls ("INSERT DO NOTHING, UPDATE, SELECT") but the current implementation makes 2 calls (1 atomic INSERT ON CONFLICT DO UPDATE + 1 SELECT). Any new tests added for `upsertTriageRecord` with comment fields must mock 2 `mockExecute` calls, not 3.

**Why it happens:** The implementation was refactored from a 2-step approach to a single atomic upsert, but the test description was not updated. The test still passes because `mockResolvedValueOnce` calls beyond what the code needs are simply unused.

**How to avoid:** When extending `upsertTriageRecord`, write tests that mock exactly 2 `mockExecute` calls: one for the INSERT ON CONFLICT and one for the SELECT.

[VERIFIED: triage.ts + triage.test.ts source inspection]

### Pitfall 3: `alreadyPosted: true` must be treated as success on the client

**What goes wrong:** The client-side mutation checks `res.ok` and then parses JSON. If the handler returns `{ alreadyPosted: true, commentId }` with HTTP 200, `res.ok` is true and `mutationFn` completes successfully. But if the developer throws inside `mutationFn` upon seeing `alreadyPosted`, the error toast fires unnecessarily.

**How to avoid:** Treat `{ alreadyPosted: true }` responses as success. The UI-SPEC confirms: "treat as success — textarea clears, 'Sent' button state fires, success toast shows." No special client branch needed.

[VERIFIED: 06-UI-SPEC.md, 06-CONTEXT.md D-03]

### Pitfall 4: Button `success` variant already exists

**What goes wrong:** Developer reaches for a custom inline style for the "Sent" confirmation state, unaware that `button.tsx` already has a `success` variant.

**How to avoid:** Use `<Button variant="success">`. The `buttonVariants` CVA definition in `button.tsx` already defines `success: 'bg-[var(--success)] text-[var(--success-foreground)]...'`.

[VERIFIED: button.tsx source inspection]

### Pitfall 5: `useToast` API mismatch

**What goes wrong:** Developer calls `toast('Note posted to GitHub')` (string argument) but `useToast().toast` is actually `addToast()` which expects `{ type, title, description? }`. The `success` and `error` convenience methods accept a string title directly.

**How to avoid:** Use `success(t('notes.postSuccess'))` not `toast(t('notes.postSuccess'))`. The `error(title)` convenience method is what Phase 5 used as `toastError()` — it's the `error` property of the `useToast()` return value, already destructured in `IssueDetailPanel` as `const { error: toastError } = useToast()`. Add `success: toast` to the destructure for the success call, or call `toast({ type: 'success', title: t('notes.postSuccess') })` directly.

[VERIFIED: useToast.ts source inspection, IssueDetailPanel.tsx line 49]

### Pitfall 6: `getUserById` returns raw `UserRow` without Zod parsing

**What goes wrong:** `getUserById` in `users.ts` casts the row directly: `return result.rows[0] as unknown as UserRow | undefined`. No Zod parse at the DB boundary.

**How to avoid:** This is a pre-existing engineering principle gap in `users.ts` — it does not follow parse-don't-validate. For Phase 6, simply access `dbUser.github_token` after the null check — do not try to "fix" the DB layer in this phase as that would be out of scope. The field exists and is typed correctly in `UserRow`.

[VERIFIED: users.ts source inspection]

---

## Code Examples

### Note Section JSX Insertion Point

```typescript
// Source: IssueDetailPanel.tsx — insert after the closing </div> of TriageSection,
// before the first <div className="border-t border-border" />

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
      {sent ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />{t('notes.sentButton')}</> : t('notes.postButton')}
    </Button>
  </div>
</div>
```

### i18n Keys to Add

```json
// en/issues.json — add at the same level as "triage":
"notes": {
  "sectionLabel": "Add a note",
  "placeholder": "Write a note to post as a GitHub comment…",
  "postButton": "Post Note",
  "sentButton": "Sent",
  "postSuccess": "Note posted to GitHub",
  "postError": "Could not post note. Try again."
}

// fr/issues.json — same structure:
"notes": {
  "sectionLabel": "Ajouter une note",
  "placeholder": "Rédigez une note à publier en tant que commentaire GitHub…",
  "postButton": "Publier la note",
  "sentButton": "Envoyé",
  "postSuccess": "Note publiée sur GitHub",
  "postError": "Impossible de publier la note. Réessayez."
}
```

[VERIFIED: en/issues.json + fr/issues.json source inspection, UI-SPEC.md]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared `GITHUB_TOKEN` env var for all routes | Per-user `github_token` from DB via `getUserById` | Phase 3 added columns; Phase 6 completes this for `comment.ts` | Comments post as the individual user's GitHub account |
| No idempotency guard on comment route | Server-side `github_comment_id` check before GitHub API call | Phase 6 (this phase) | Safe retries after network failures |

**Deprecated/outdated:**
- `GITHUB_TOKEN` env var usage in `comment.ts`: the route was left using the shared PAT. Phase 6 fixes this as part of D-04. Other routes (issues, labels) have already been updated in Phase 3 via `AUTH-13`.

---

## Runtime State Inventory

> Phase 6 is not a rename/refactor/migration phase. No runtime state inventory required.

Step 2.5: SKIPPED — this is a feature addition phase, not a rename/refactor.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API handler | ✓ | Runtime environment | — |
| Turso / SQLite (`dev.db`) | `issue_triage` reads/writes | ✓ | `file:dev.db` in mock mode | Mock mode uses SQLite |
| GitHub API | `POST /repos/.../issues/.../comments` | ✓ (network) | REST v3 | Mock route in `github-fixtures.ts` |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- GitHub API: not available without real OAuth token, but `github-fixtures.ts` mock route covers `MOCK_SERVICES=true` dev env.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (multi-project) |
| Config file | `apps/web/vite.config.ts` (test section) |
| Quick run command | `cd apps/web && npx vitest run --project api` or `--project frontend` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTES-01 | Note textarea renders in panel, Post Note button fires mutation with correct args | unit (frontend) | `cd apps/web && npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx` | ✅ (extend existing) |
| NOTES-01 | `comment.ts` handler returns comment on valid POST | unit (api) | `cd apps/web && npx vitest run --project api api/github/repos/\[owner\]/\[repo\]/issues/\[number\]/comment.test.ts` | ❌ Wave 0 |
| NOTES-01 | `upsertTriageRecord` accepts `githubCommentId` + `commentStatus` | unit (api) | `cd apps/web && npx vitest run --project api api/_lib/db/triage.test.ts` | ✅ (extend existing) |
| NOTES-02 | `comment.ts` returns `{ alreadyPosted: true }` when `github_comment_id` already set | unit (api) | `cd apps/web && npx vitest run --project api api/github/repos/\[owner\]/\[repo\]/issues/\[number\]/comment.test.ts` | ❌ Wave 0 |
| NOTES-02 | `comment.ts` saves `githubCommentId` to triage after successful GitHub post | unit (api) | same file above | ❌ Wave 0 |
| NOTES-03 | `onSuccess` calls toast with success message and clears textarea | unit (frontend) | `cd apps/web && npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx` | ✅ (extend existing) |
| NOTES-03 | `onError` calls toast with error message and preserves textarea text | unit (frontend) | same file above | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `cd apps/web && npx vitest run --project api api/_lib/db/triage.test.ts` or `npx vitest run --project frontend src/client/components/IssueDetailPanel.test.tsx`
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.test.ts` — covers NOTES-01 (valid POST), NOTES-02 (idempotency guard returns `alreadyPosted`), NOTES-02 (saves `githubCommentId`), per-user token fix (D-04)
- [ ] Extend `apps/web/api/_lib/db/triage.test.ts` — add test for `upsertTriageRecord` with `githubCommentId` + `commentStatus` fields (NOTES-02 DB layer)
- [ ] Extend `apps/web/src/client/components/IssueDetailPanel.test.tsx` — add NOTES-01, NOTES-03 tests (textarea renders, mutation args, onSuccess clears, onError preserves, toast calls)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authenticateRequest()` — JWT verification before any action |
| V3 Session Management | no | Session handled by existing JWT infrastructure |
| V4 Access Control | yes | `authenticateRequest()` required — unauthenticated requests return 401 |
| V5 Input Validation | yes | `githubCommentSchema.safeParse(req.body)` → 400 on invalid input |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Posting comment as wrong user | Spoofing | Per-user token from DB (D-04): user can only post as themselves |
| Replay / double-post on retry | Tampering | Server-side idempotency check on `github_comment_id` (D-03) |
| Posting empty or oversized comment | Tampering | `githubCommentSchema` validates `body: z.string().min(1).max(65536)` |
| Unauthorized comment post (no auth) | Elevation of Privilege | `authenticateRequest()` returns 401 if no/invalid token |
| User with no GitHub token | Elevation of Privilege | Check `dbUser.github_token` null → 403 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `success` toast can be called via `useToast().success(title)` (not `toast({ type: 'success', title })`) | Code Examples | Low — both work; just pick one |
| A2 | `getUserById` in `users.ts` does not need Zod parse for this phase — direct cast is acceptable | Common Pitfalls (Pitfall 6) | Low — field exists and is typed; fixing parse-don't-validate in users.ts is out of scope |

**All other claims in this research were verified by direct source file inspection.**

---

## Open Questions

1. **`githubFetch()` spread order for Authorization override**
   - What we know: `githubFetch()` sets `'Authorization': \`Bearer ${token}\`` and then spreads `...options.headers`, so options headers come AFTER defaults in the spread — meaning callers CAN override Authorization.
   - What's unclear: Whether this is intentional or accidental. If a future PR reorders the spread, callers relying on override would break silently.
   - Recommendation: In `comment.ts`, bypass `githubFetch()` entirely for the per-user token case. Use a raw `fetch()` call. This is explicit and robust.

2. **`upsertTriageRecord` test vs implementation mismatch**
   - What we know: `triage.test.ts` describes 3 execute calls ("INSERT DO NOTHING, UPDATE, SELECT") but the actual code makes 2 (atomic INSERT ON CONFLICT DO UPDATE + SELECT). The test still passes because extra `mockResolvedValueOnce` calls are unused.
   - What's unclear: Whether this test accurately exercises the code path.
   - Recommendation: When writing new `upsertTriageRecord` tests for comment fields, mock exactly 2 execute calls. Do not fix the existing test description in this phase (out of scope).

---

## Sources

### Primary (HIGH confidence — source file inspection)

- `apps/web/api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` — current handler shape
- `apps/web/api/_lib/db/triage.ts` — `upsertTriageRecord` signature and SQL pattern
- `apps/web/api/_lib/validation.ts` — `githubCommentSchema`, `triageDbRowSchema`
- `apps/web/src/client/components/IssueDetailPanel.tsx` — triage mutation pattern, `useToast` usage
- `apps/web/src/client/components/IssueDetailPanel.test.tsx` — test structure to extend
- `apps/web/src/client/components/ui/input.tsx` — `Textarea` component template
- `apps/web/src/client/components/ui/button.tsx` — `success` variant confirmed
- `apps/web/src/client/hooks/useToast.ts` — `success()` and `error()` API
- `apps/web/src/client/lib/api-client.ts` — `authenticatedFetch` signature
- `apps/web/api/_lib/auth/middleware.ts` — `authenticateRequest` returns `{ userId, email, role }`
- `apps/web/api/_lib/db/users.ts` — `getUserById` signature and return type
- `apps/web/api/_lib/github.ts` — `githubFetch()` token handling
- `apps/web/scripts/mocks/github-fixtures.ts` — mock route registration pattern
- `apps/web/src/shared/i18n/locales/en/issues.json` — existing key structure
- `apps/web/src/shared/i18n/locales/fr/issues.json` — existing French keys
- `.planning/phases/06-notes/06-UI-SPEC.md` — Textarea class string, button state machine, i18n contract
- `.planning/phases/06-notes/06-CONTEXT.md` — locked decisions D-01 through D-06
- `apps/web/vite.config.ts` — test project configuration (api / frontend / scripts)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by source file inspection; no new dependencies required
- Architecture: HIGH — all patterns traced directly to existing source files in the codebase
- Pitfalls: HIGH — all identified from source file inspection, not speculation

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase — no fast-moving external dependencies)

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to this phase and must be enforced in planning:

| Directive | Impact on Phase 6 |
|-----------|-------------------|
| **Vercel AI SDK only** | Not applicable — Phase 6 has no AI layer |
| **i18n required** | All note UI text must use `react-i18next` keys; add to both `en/issues.json` and `fr/issues.json` |
| **No `process.platform` direct** | Not applicable — no platform detection in this phase |
| **No time estimates** | Plans must use priority ordering, not duration |
| **PR target `develop`** | PRs must target `develop` not `main` |
| **No `console.log` in production** | Existing `console.error` calls in mock routes are acceptable (dev-only); do not add `console.log` to `comment.ts` |
| **Parse-don't-validate** | `comment.ts` must use `githubCommentSchema.safeParse(req.body)` (already present) and `z.parse()` for path params |
| **Functional core / imperative shell** | `comment.ts` must follow 4-step shape: parse → authorize → pure domain → respond |
| **FSM / illegal state elimination** | No new domain state types in this phase; existing `TriageState` union is not modified |
| **Red-green TDD** | Write failing tests FIRST in `comment.test.ts` and `IssueDetailPanel.test.tsx` before implementation |
| **Mock services** | Add `POST /api/github/repos/:owner/:repo/issues/:number/comment` mock in `github-fixtures.ts` |
