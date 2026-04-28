# Phase 3: GitHub OAuth Login - Pattern Map

**Mapped:** 2026-04-21
**Files analyzed:** 20 new/modified files
**Analogs found:** 20 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `api/auth/github.ts` | route | request-response | `api/auth/me.ts` | role-match |
| `api/auth/github/callback.ts` | route | request-response | `api/auth/me.ts` + `api/github/repos/.../issues.ts` | role-match |
| `api/_lib/db/client.ts` (migration 012) | config | CRUD | self (append MIGRATIONS array) | exact |
| `api/_lib/db/users.ts` (upsertOAuthUser) | model | CRUD | self (`createUser`, `getUserById`) | exact |
| `api/_lib/github.ts` (signature change) | utility | request-response | self (current `githubFetch`) | exact |
| `api/auth/me.ts` (expose githubLogin) | route | request-response | self | exact |
| `api/settings/index.ts` (remove githubToken) | route | CRUD | self | exact |
| `api/github/repos/[owner]/[repo]/issues.ts` | route | request-response | self | exact |
| `api/github/repos/[owner]/[repo]/labels.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/repos/[owner]/[repo]/issues/[number]/comment.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/repos/[owner]/[repo]/branches.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/repos/[owner]/[repo]/pulls/index.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/repos/[owner]/[repo]/pulls/[number]/index.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/repos/[owner]/[repo]/pulls/[number]/files.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/projects/[owner]/[number]/index.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `api/github/projects/[owner]/[number]/items.ts` | route | request-response | `api/github/repos/.../issues.ts` | exact |
| `src/client/components/LoginPage.tsx` | component | request-response | self (full replacement) | exact |
| `src/client/stores/auth-store.ts` | store | request-response | self | exact |
| `src/client/stores/settings-store.ts` | store | CRUD | self | exact |
| `src/client/App.tsx` (token pickup) | component | request-response | self | exact |
| `src/shared/i18n/locales/en/auth.json` | config | — | self | exact |
| `src/shared/i18n/locales/fr/auth.json` | config | — | self | exact |

---

## Pattern Assignments

### `api/auth/github.ts` (NEW — OAuth initiate route)

**Analog:** `apps/web/api/auth/me.ts`

**Imports pattern** (`api/auth/me.ts` lines 1–4):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDb } from '../_lib/db/client.js';
import { authenticateRequest } from '../_lib/auth/middleware.js';
import { getUserById } from '../_lib/db/users.js';
```

**Handler skeleton pattern** (`api/auth/me.ts` lines 6–22):
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // ... logic ...
}
```

**Crypto import pattern** (`api/_lib/auth/jwt.ts` line 1):
```typescript
import crypto from 'crypto';
```

**New file full pattern** (from RESEARCH.md Pattern 1):
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:5173/api/auth/github/callback';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!GITHUB_CLIENT_ID) return res.status(500).json({ error: 'GitHub OAuth not configured' });

  const state = crypto.randomBytes(16).toString('hex');

  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: 'repo',
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
```

Note: `ensureDb()` is NOT called here — this route is unauthenticated (pre-login). No auth middleware.

---

### `api/auth/github/callback.ts` (NEW — OAuth callback route)

**Analog:** `apps/web/api/auth/me.ts` (handler structure) + `apps/web/api/github/repos/[owner]/[repo]/issues.ts` (try/catch error handling)

**Handler + try/catch pattern** (`api/github/repos/.../issues.ts` lines 7–53):
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // (no authenticateRequest here — this is the pre-auth callback)

  try {
    // ... logic ...
    res.json({ ... });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**JWT issuance** (`api/_lib/auth/jwt.ts` lines 19–33 — reuse `createToken` unchanged):
```typescript
import { createToken } from '../../_lib/auth/jwt.js';
// ...
const jwt = createToken(user.id, user.email, user.role);
// createToken(userId: string, email: string, role: string): string
```

**DB user lookup** (`api/_lib/db/users.ts` lines 71–74 — reuse `userCount` unchanged):
```typescript
import { userCount } from '../../_lib/db/users.js';
// ...
const count = await userCount();
const role = count === 0 ? 'admin' : 'member';
```

**Cookie parsing** (no library — inline string split):
```typescript
const cookieHeader = req.headers.cookie || '';
const cookieState = cookieHeader
  .split('; ')
  .find((c) => c.startsWith('oauth_state='))
  ?.split('=')[1];
```

**State cookie clear + redirect**:
```typescript
res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Max-Age=0; Path=/');
res.redirect(302, `/?token=${jwt}`);
```

---

### `api/_lib/db/client.ts` — Append migration 012

**Analog:** self — append to `MIGRATIONS` array (`api/_lib/db/client.ts` lines 67–217)

**Migration array entry pattern** (lines 188–216 — migration `011_issue_triage` as model):
```typescript
{
  name: '011_issue_triage',
  sql: `
    CREATE TABLE IF NOT EXISTS issue_triage (
      github_repo TEXT NOT NULL,
      ...
    );
  `,
},
```

**New migration to append** (after line 217):
```typescript
{
  name: '012_github_oauth',
  sql: `
    DROP TABLE IF EXISTS otp_codes;
    ALTER TABLE users ADD COLUMN github_token TEXT;
    ALTER TABLE users ADD COLUMN github_login TEXT;
  `,
},
```

**bootstrapAdmin removal** — lines 51–65 (`bootstrapAdmin` function) and line 21 (`await bootstrapAdmin(c)` call) must both be deleted. See RESEARCH.md Pitfall 1.

---

### `api/_lib/db/users.ts` — Add `upsertOAuthUser`, update `UserRow`

**Analog:** self — follow `createUser` pattern (`api/_lib/db/users.ts` lines 29–34)

**Existing `createUser` pattern**:
```typescript
export async function createUser(id: string, email: string, name: string, passwordHash: string, role = 'member'): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    args: [id, email, name, passwordHash, role],
  });
}
```

**Existing `getUserById` pattern** (lines 21–27 — used in every route for token resolution):
```typescript
export async function getUserById(id: string): Promise<UserRow | undefined> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return result.rows[0] as unknown as UserRow | undefined;
}
```

**New `UserRow` interface** — add `github_token` and `github_login` to existing interface (lines 3–11):
```typescript
export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: string;
  github_token: string | null;  // ADD
  github_login: string | null;  // ADD
  created_at: string;
  updated_at: string;
}
```

**New `upsertOAuthUser` function** — follow `createUser` pattern with upsert SQL from RESEARCH.md Pitfall 6:
```typescript
export async function upsertOAuthUser(params: {
  githubId: string;
  email: string;
  name: string;
  githubLogin: string;
  githubToken: string;
  role: string;
}): Promise<UserRow> {
  const id = uuid();
  await getClient().execute({
    sql: `INSERT INTO users (id, email, name, github_login, github_token, role)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            github_login = excluded.github_login,
            github_token = excluded.github_token,
            name = CASE WHEN users.name = '' THEN excluded.name ELSE users.name END,
            updated_at = datetime('now')`,
    args: [id, params.email, params.name, params.githubLogin, params.githubToken, params.role],
  });
  const user = await getUserByEmail(params.email);
  return user!;
}
```

Note: Import `uuid` — it's already in `package.json` as `uuid: ^11.1.0`. Add `import { v4 as uuid } from 'uuid';` to `users.ts`.

---

### `api/_lib/github.ts` — Signature change

**Analog:** self (lines 24–64 — existing `githubFetch`)

**Current signature** (lines 24–25):
```typescript
export async function githubFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getGitHubToken();
```

**New signature** — add `token` as first parameter, remove `getGitHubToken()` call:
```typescript
export async function githubFetch(token: string, url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  // Rate-limit detection block (lines 37–61) is unchanged
```

**`githubGraphQL` current signature** (lines 66–80):
```typescript
export async function githubGraphQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const token = await getGitHubToken();
```

**New `githubGraphQL` signature** — same pattern as `githubFetch`:
```typescript
export async function githubGraphQL(token: string, query: string, variables: Record<string, any> = {}): Promise<any> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  // error handling unchanged (lines 77–80)
```

**Delete** `getGitHubToken()` function entirely (lines 18–22). Remove `import { resolveConfig } from './config-resolver.js'` if `resolveConfig` is no longer used in this file (verify first — `config-resolver.ts` is still used by `github-sync.ts` but that's a different file).

---

### `api/auth/me.ts` — Expose `githubLogin`

**Analog:** self (lines 1–22)

**Current response** (line 21):
```typescript
res.json({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role });
```

**Updated response** — add `githubLogin`:
```typescript
res.json({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, githubLogin: dbUser.github_login ?? null });
```

No other changes. `getUserById` return type update (via `UserRow`) provides `github_login`.

---

### `api/settings/index.ts` — Remove `githubToken`

**Analog:** self (lines 1–70)

**Current `VALID_KEYS`** (lines 6–16):
```typescript
const VALID_KEYS = [
  'theme',
  'colorTheme',
  'language',
  'anthropicApiKey',
  'githubToken',       // REMOVE this line
  'gitlabToken',
  'gitlabInstanceUrl',
  'syncInterval',
  'defaultModel',
] as const;
```

**Current `SENSITIVE_KEYS`** (line 18):
```typescript
const SENSITIVE_KEYS = ['anthropicApiKey', 'githubToken', 'gitlabToken'];
// becomes:
const SENSITIVE_KEYS = ['anthropicApiKey', 'gitlabToken'];
```

The `maskValue` function and all other logic remain unchanged.

---

### GitHub proxy routes — 9 files (pass user token)

**Analog:** `apps/web/api/github/repos/[owner]/[repo]/issues.ts` (lines 1–53) — the exact pattern all 9 files already follow

**Current `githubFetch` call** (lines 31–34):
```typescript
const response = await githubFetch(
  `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`
);
```

**Migration pattern** — insert token resolution after `authenticateRequest`, before `try`:
```typescript
const user = await authenticateRequest(req, res);
if (!user) return;

// NEW: resolve per-user GitHub token
const dbUser = await getUserById(user.userId);
if (!dbUser?.github_token) {
  return res.status(403).json({ error: 'GitHub account not connected' });
}

try {
  // ...
  const response = await githubFetch(
    dbUser.github_token,   // token is now first argument
    `${GITHUB_API}/repos/${...}/issues?${params}`
  );
```

**Import additions** for each file — add `getUserById`:
```typescript
import { getUserById } from '../../../../_lib/db/users.js';
// (path depth varies per file)
```

For GraphQL files (`projects/[owner]/[number]/index.ts`, `projects/[owner]/[number]/items.ts`), same pattern but call `githubGraphQL(dbUser.github_token, query, variables)`.

---

### `src/client/components/LoginPage.tsx` — Full replacement

**Analog:** self (lines 1–109) — reuse layout structure, i18n pattern, Button import

**i18n pattern** (lines 9–10):
```typescript
const { t } = useTranslation(['auth']);
// ...
t('auth:welcome')
t('auth:welcomeDescription')
```

**Outer layout** (lines 47–49 — keep the centering wrapper):
```jsx
<div className="flex items-center justify-center min-h-screen bg-background">
  <div className="w-full max-w-sm mx-auto p-6">
    <div className="text-center mb-8">
```

**Button import** (line 5):
```typescript
import { Button } from './ui/button';
```

**New component** — replace all form logic with a single anchor/button:
```tsx
export function LoginPage() {
  const { t } = useTranslation(['auth']);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{t('auth:welcome')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth:welcomeDescription')}</p>
        </div>
        <Button asChild className="w-full">
          <a href="/api/auth/github">{t('auth:signInWithGitHub')}</a>
        </Button>
      </div>
    </div>
  );
}
```

Imports to remove: `useState`, `useRef`, `useEffect`, `Input`, `Label`, `useAuthStore`.

---

### `src/client/stores/auth-store.ts` — Remove OTP, add OAuth

**Analog:** self (lines 1–105)

**Zustand persist + devtools wrapper** (lines 26–105 — keep unchanged):
```typescript
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // ...
      }),
      { name: 'aperant-auth' }   // localStorage key — do NOT change
    ),
    { name: 'auth-store' }
  )
);
```

**User interface** (lines 4–9) — add `githubLogin`:
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  githubLogin?: string | null;  // ADD
}
```

**Actions to REMOVE** from `AuthState` interface and implementation:
- `requestOtp: (email: string) => Promise<boolean>` (lines 22, 40–58)
- `verifyOtp: (email: string, code: string) => Promise<boolean>` (lines 23, 60–79)

**Action to ADD** — `initiateGitHubOAuth`:
```typescript
initiateGitHubOAuth: () => {
  window.location.href = '/api/auth/github';
},
```

**`checkSession` pattern** (lines 81–99 — keep unchanged, but `setAuth` response now includes `githubLogin`):
```typescript
checkSession: async () => {
  const { token } = get();
  if (!token) return false;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      set({ token: null, user: null });
      return false;
    }
    const user = await res.json();
    set({ user });  // user now includes githubLogin from updated /api/auth/me
    return true;
  } catch {
    set({ token: null, user: null });
    return false;
  }
},
```

---

### `src/client/stores/settings-store.ts` — Remove `githubToken`

**Analog:** self (lines 1–83)

**Fields to REMOVE**:
- `githubToken: string` (line 13 of interface, line 49 of initial state)
- `setGithubToken: (token: string) => void` (line 28 of interface, line 62 of implementation)
- `githubToken: settings.githubToken || ''` from `loadFromApi` (line 75)

All other fields, actions, and the `devtools` wrapper remain unchanged.

---

### `src/client/App.tsx` — OAuth token pickup

**Analog:** self (lines 32–53) — the existing `useEffect` on mount

**Current mount effect** (lines 36–42):
```typescript
useEffect(() => {
  if (token) {
    checkSession().finally(() => setAuthChecked(true));
  } else {
    setAuthChecked(true);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Updated mount effect** — detect `?token=` before session check:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const oauthToken = params.get('token');
  if (oauthToken) {
    // OAuth callback redirect — pick up JWT, clean URL
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${oauthToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user) useAuthStore.getState().setAuth(oauthToken, user);
        window.history.replaceState({}, '', '/');
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  } else if (token) {
    checkSession().finally(() => setAuthChecked(true));
  } else {
    setAuthChecked(true);
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

No other changes to `App.tsx`.

---

### `src/shared/i18n/locales/en/auth.json` — Replace OTP keys with OAuth keys

**Analog:** self (lines 1–31)

**Keys to REMOVE** (OTP-specific):
```
email, emailPlaceholder, sendCode, verifyCode, codePlaceholder, codeSent,
codeError, sendError, rateLimited, backToEmail
```

**Keys to KEEP** (reuse):
```
login, logout, welcome, users.*
```

**Key to UPDATE** — `welcomeDescription`:
```json
"welcomeDescription": "Sign in with your GitHub account"
```

**Keys to ADD**:
```json
"signInWithGitHub": "Sign in with GitHub",
"oauthError": "GitHub sign-in failed, please try again"
```

**Full updated file**:
```json
{
  "login": "Sign In",
  "logout": "Sign Out",
  "welcome": "Welcome to Aperant",
  "welcomeDescription": "Sign in with your GitHub account",
  "signInWithGitHub": "Sign in with GitHub",
  "oauthError": "GitHub sign-in failed, please try again",
  "users": {
    "title": "User Management",
    "addUser": "Add User",
    "email": "Email",
    "name": "Name",
    "role": "Role",
    "admin": "Admin",
    "member": "Member",
    "viewer": "Viewer",
    "deleteConfirm": "Are you sure you want to remove this user?",
    "added": "User added",
    "deleted": "User removed",
    "updated": "Role updated",
    "emailTaken": "Email already registered"
  }
}
```

---

### `src/shared/i18n/locales/fr/auth.json` — Replace OTP keys with OAuth keys

**Analog:** self (lines 1–31) — mirror the English changes

**Full updated file**:
```json
{
  "login": "Se connecter",
  "logout": "Se deconnecter",
  "welcome": "Bienvenue sur Aperant",
  "welcomeDescription": "Connectez-vous avec votre compte GitHub",
  "signInWithGitHub": "Se connecter avec GitHub",
  "oauthError": "Echec de la connexion GitHub, veuillez reessayer",
  "users": {
    "title": "Gestion des utilisateurs",
    "addUser": "Ajouter un utilisateur",
    "email": "Email",
    "name": "Nom",
    "role": "Role",
    "admin": "Administrateur",
    "member": "Membre",
    "viewer": "Lecteur",
    "deleteConfirm": "Etes-vous sur de vouloir supprimer cet utilisateur ?",
    "added": "Utilisateur ajoute",
    "deleted": "Utilisateur supprime",
    "updated": "Role mis a jour",
    "emailTaken": "Email deja utilise"
  }
}
```

---

## Shared Patterns

### Route Handler Skeleton
**Source:** `apps/web/api/auth/me.ts` (lines 6–22)
**Apply to:** `api/auth/github.ts`, `api/auth/github/callback.ts`
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();                               // call on routes that touch DB

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req, res);
  if (!user) return;                              // 401 already sent by middleware

  // ... logic ...
  res.json({ ... });
}
```
Note: `api/auth/github.ts` does NOT call `ensureDb()` or `authenticateRequest()` — it is a public pre-auth route.

### authenticateRequest + getUserById Token Resolution
**Source:** `apps/web/api/auth/me.ts` (lines 13–19) + RESEARCH.md Pattern 4
**Apply to:** All 9 `api/github/` route files
```typescript
const user = await authenticateRequest(req, res);
if (!user) return;

const dbUser = await getUserById(user.userId);
if (!dbUser?.github_token) {
  return res.status(403).json({ error: 'GitHub account not connected' });
}
// then: githubFetch(dbUser.github_token, url)
```

### Error Response Format
**Source:** `apps/web/api/auth/me.ts` lines 18, 10; `api/github/repos/.../issues.ts` lines 11, 48–51
**Apply to:** All route files
```typescript
// Method guard
return res.status(405).json({ error: 'Method not allowed' });
// Not found
return res.status(404).json({ error: 'User not found' });
// Rate limit (already in issues.ts)
return res.status(429).json({ error: 'rate_limited', retryAfter: error.retryAfter });
// Internal
res.status(500).json({ error: 'Internal server error' });
```

### Zustand Store Pattern
**Source:** `apps/web/src/client/stores/auth-store.ts` (lines 26–105)
**Apply to:** `auth-store.ts` and `settings-store.ts` modifications
```typescript
export const useStore = create<State>()(
  devtools(
    persist(            // only auth-store uses persist
      (set, get) => ({
        // state fields
        // action functions: (set, get) => pattern
      }),
      { name: 'aperant-auth' }
    ),
    { name: 'auth-store' }
  )
);
```

### i18n Translation Key Access
**Source:** `apps/web/src/client/components/LoginPage.tsx` (lines 9, 44)
**Apply to:** `LoginPage.tsx` replacement
```typescript
const { t } = useTranslation(['auth']);
// Usage:
t('auth:welcome')
t('auth:signInWithGitHub')
// Error with fallback:
const errorMessage = error ? t(`auth:${error}`, { defaultValue: error }) : null;
```

### DB Execute Pattern
**Source:** `apps/web/api/_lib/db/users.ts` (lines 13–18, 21–27)
**Apply to:** `upsertOAuthUser` in `users.ts`, token resolution in callback route
```typescript
const result = await getClient().execute({
  sql: 'SELECT * FROM users WHERE id = ?',
  args: [id],
});
return result.rows[0] as unknown as UserRow | undefined;
```

---

## No Analog Found

No files in this phase lack an analog. All patterns have direct codebase matches.

---

## Metadata

**Analog search scope:** `apps/web/api/`, `apps/web/src/client/`
**Files read:** 12 source files
**Pattern extraction date:** 2026-04-21

### Key invariants for planner

1. **`api/auth/github.ts` is unauthenticated** — no `ensureDb()`, no `authenticateRequest()`. Cookie state set here is read in callback.
2. **`api/auth/github/callback.ts` is unauthenticated** — exchanges code for token server-side. `ensureDb()` IS needed (DB writes). No `authenticateRequest()`.
3. **`github-sync.ts` is OUT OF SCOPE** — it has its own internal `githubFetch`/`getGitHubToken`. Do not touch it.
4. **`bootstrapAdmin` must be fully removed** — both function body (lines 51–65) and call site (line 21) in `client.ts`.
5. **`uuid` import needed in `users.ts`** — not currently imported there; add `import { v4 as uuid } from 'uuid';`.
6. **`resend` npm package removal** — `npm uninstall resend` in `apps/web/` directory as part of D-14 cleanup.
7. **Migration 012 drops `otp_codes` table** — `DROP TABLE IF EXISTS otp_codes` must be in the migration SQL.
8. **`SameSite=Lax` not Strict** — RESEARCH.md Pitfall 2 is critical; Strict blocks the OAuth callback redirect.
