---
phase: 08-rename-from-aperant-to-currents
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - apps/web/src/client/stores/auth-store.ts
  - apps/web/src/client/lib/api-client.ts
  - apps/web/package.json
  - apps/web/index.html
  - apps/web/src/client/styles/globals.css
  - apps/web/src/shared/i18n/locales/en/common.json
  - apps/web/src/shared/i18n/locales/fr/common.json
  - apps/web/src/shared/i18n/locales/en/auth.json
  - apps/web/src/shared/i18n/locales/fr/auth.json
  - apps/web/src/shared/i18n/locales/en/settings.json
  - apps/web/src/shared/i18n/locales/fr/settings.json
  - apps/web/README.md
  - apps/web/SPEC.md
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase renames the product from "Aperant" to "Currents" across the web application. The rename is complete — no residual "Aperant" strings remain in any of the reviewed files. `package-lock.json` was excluded from analysis per the lock-file filter rule.

The reviewed files are generally well-structured and follow project conventions. No critical security vulnerabilities were found. Three warnings were identified: dead code from a removed auth flow, an unvalidated API response silently populating the auth store, and an untyped `any[]` return in the API client that violates the project's Parse-Don't-Validate principle. Five info-level items were found covering missing French accent marks, a phantom color-theme key, and minor typing gaps.

---

## Warnings

### WR-01: Dead code — `initiateGitHubOAuth` contradicts OTP-only auth model

**File:** `apps/web/src/client/stores/auth-store.ts:40-42`
**Issue:** `initiateGitHubOAuth` redirects to `/api/auth/github`, but SPEC.md §12 explicitly describes an OTP-only authentication system. No GitHub OAuth endpoint is documented or appears in the API endpoint table. This method is dead code left over from an earlier auth design. If a component mistakenly calls it, it will navigate to a 404 route.
**Fix:** Remove the method from the store and from the `AuthState` interface:
```typescript
// Delete from AuthState interface:
initiateGitHubOAuth: () => void;

// Delete from store implementation:
initiateGitHubOAuth: () => {
  window.location.href = '/api/auth/github';
},
```

### WR-02: `checkSession` sets user state from unvalidated API response

**File:** `apps/web/src/client/stores/auth-store.ts:55-56`
**Issue:** The response from `/api/auth/me` is passed directly to `set({ user })` without any runtime shape validation. If the API returns an unexpected payload (e.g., after a schema migration or a bug in the backend), the store silently holds a malformed user object, which can cause subtle downstream failures throughout the app. This violates the Parse-Don't-Validate principle in CLAUDE.md.
**Fix:** Parse the response with a Zod schema before storing:
```typescript
import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'member', 'viewer']),
  githubLogin: z.string().nullable().optional(),
});

// In checkSession:
const rawUser = await res.json();
const user = userSchema.parse(rawUser); // throws on invalid shape
set({ user });
```

### WR-03: `getProjectItems` typed as `any[]` in API client

**File:** `apps/web/src/client/lib/api-client.ts:89-92`
**Issue:** The `items` field in the `getProjectItems` return type is `any[]`, which defeats the type system for all callers of this method and violates the Parse-Don't-Validate rule. Any code consuming `items` must cast or guess the shape.
**Fix:** Define and use a typed interface for GitHub Project items. At minimum, replace `any[]` with `unknown[]` as a signal to callers that parsing is required, or define a schema:
```typescript
interface GitHubProjectItem {
  id: string;
  title: string;
  // add remaining fields as known
}

getProjectItems: (owner: string, number: number, cursor?: string) =>
  request<{ items: GitHubProjectItem[]; hasMore: boolean; endCursor: string }>(
    `/github/projects/${encodeURIComponent(owner)}/${number}/items${cursor ? `?${new URLSearchParams({ cursor })}` : ''}`
  ),
```

---

## Info

### IN-01: French locale strings missing accent characters

**File:** `apps/web/src/shared/i18n/locales/fr/auth.json:3,7,15,19,20,21`
**Issue:** Several French strings are missing standard accent characters, producing grammatically incorrect French for native speakers:
- Line 3: `"Se deconnecter"` → should be `"Se déconnecter"`
- Line 7: `"Echec de la connexion GitHub, veuillez reessayer"` → should be `"Échec de la connexion GitHub, veuillez réessayer"`
- Line 15: `"Etes-vous sur de vouloir supprimer cet utilisateur ?"` → should be `"Êtes-vous sûr de vouloir supprimer cet utilisateur ?"`
- Line 19: `"Utilisateur ajoute"` → `"Utilisateur ajouté"`
- Line 20: `"Utilisateur supprime"` → `"Utilisateur supprimé"`
- Line 21: `"Role mis a jour"` → `"Rôle mis à jour"`
- Line 22: `"Email deja utilise"` → `"Email déjà utilisé"`

**Fix:** Restore correct French diacritics in each affected string.

### IN-02: Phantom `forest` color-theme key in both locale settings files

**File:** `apps/web/src/shared/i18n/locales/en/settings.json:24`, `apps/web/src/shared/i18n/locales/fr/settings.json:24`
**Issue:** Both locale files define `colorTheme.forest` but the desktop app's 7 themes (Default, Dusk, Lime, Ocean, Retro, Neo — per CLAUDE.md and README.md) do not include "Forest". This key is either a leftover from an earlier iteration or an unreleased theme. It adds noise and may confuse future contributors.
**Fix:** Remove `"forest"` from both `en/settings.json` and `fr/settings.json` unless a Forest theme is actively planned:
```json
// Remove from colorTheme in both files:
"forest": "Forest"   // en
"forest": "Forêt"    // fr
```

### IN-03: `User` type defined locally instead of imported from shared types

**File:** `apps/web/src/client/stores/auth-store.ts:4-10`
**Issue:** The `User` interface is defined inline in the store file rather than imported from `@shared/types/`. If the canonical user type evolves (e.g., new fields are added by the backend), this local copy will diverge silently.
**Fix:** Move the `User` interface to `apps/web/src/shared/types/` and import it:
```typescript
// shared/types/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  githubLogin?: string | null;
}

// auth-store.ts
import type { User } from '@shared/types/user';
```

### IN-04: Silent swallowing of `localStorage` parse errors in `getAuthToken`

**File:** `apps/web/src/client/lib/api-client.ts:13-16`
**Issue:** The `catch` block in `getAuthToken` returns `null` without logging or distinguishing between "no stored token" and "corrupted localStorage". A corrupted auth entry will silently cause every API request to be unauthenticated, which is hard to diagnose.
**Fix:** At minimum, log a warning in the catch block (using a development-only guard since `console.log` is prohibited in production per CLAUDE.md):
```typescript
} catch (e) {
  if (import.meta.env.DEV) console.warn('[api-client] Failed to parse auth token from localStorage', e);
  return null;
}
```

### IN-05: `request<T>` returns unvalidated JSON cast to `T`

**File:** `apps/web/src/client/lib/api-client.ts:34`
**Issue:** `return res.json()` is typed as `Promise<T>` via the generic parameter but performs no runtime validation. Every caller receives an unverified server payload typed as `T`. This is a known gap in the Parse-Don't-Validate coverage; callers should validate with Zod schemas at the point of use if the response shape is critical to correctness.
**Fix:** This is an architectural note rather than a line-level fix — callers of `api.*` methods that use the results in domain logic should pipe through a Zod schema at the call site, following the pattern in CLAUDE.md:
```typescript
// Example in a component or store:
const raw = await api.tasks.get(id);
const task = taskSchema.parse(raw); // validate before use
```

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
