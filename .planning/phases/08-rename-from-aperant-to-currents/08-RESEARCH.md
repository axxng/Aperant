# Phase 8: Rename from Aperant to Currents — Research

**Researched:** 2026-04-22
**Domain:** Text substitution / branding rename across apps/web/ codebase
**Confidence:** HIGH

## Summary

Phase 8 is a branding rename: every occurrence of "Aperant" in the active scope (`apps/web/`) is replaced with "Currents". The active scope is `apps/web/` exclusively — `apps/desktop/` carries the same rename debt but is explicitly out of this project's scope per PROJECT.md.

The rename touches six distinct categories: package naming, a runtime localStorage key (the only runtime state concern), user-visible i18n strings, a CSS comment, documentation files, and the HTML page title. There are no database schema changes, no API contract changes, and no migration scripts needed — the Turso DB schema contains no "Aperant" column or table names.

The one operationally sensitive change is the Zustand persist key `aperant-auth` in localStorage. Renaming this key will silently log out any currently-authenticated users on their next page load because the old key will no longer be read. This is acceptable behaviour for a rename (sessions are short-lived JWT tokens), but the planner must document this as a known side-effect.

The test suite is green at baseline (143 tests / 18 files, verified 2026-04-22). No tests reference "Aperant" — tests use the resolved i18n string values directly, not the key names, so i18n changes require no test updates.

**Primary recommendation:** Execute all changes in a single plan wave — every file is independent, there are no cascading compile-time dependencies between the rename sites, and the change set is small enough to validate in one `npm test` run.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Package naming | Build tooling | — | `package.json` name field; affects monorepo workspace resolution |
| localStorage persist key | Browser / Client | — | Zustand persist middleware reads/writes this key client-side only |
| i18n display strings | Frontend (SPA) | — | All resolved at render time via react-i18next |
| CSS comment | Frontend (SPA) | — | Developer comment; no runtime effect |
| Documentation | Repository | — | README.md and SPEC.md are dev-facing docs, not deployed |
| HTML page title | Frontend Server (SSR) | — | `<title>` in index.html; rendered at page load |

## Project Constraints (from CLAUDE.md)

- **i18n required** — All user-facing text uses react-i18next translation keys. Both `en/*.json` and `fr/*.json` must be updated simultaneously.
- **No console.log in production code** — Not applicable to this rename; no new code paths introduced.
- **Minimal changes only** — Rename only what says "Aperant"; do not refactor unrelated code.
- **apps/web/ scope** — PROJECT.md explicitly states `apps/desktop/` is not part of this project's scope. The root `README.md` and `package-lock.json` carry Aperant references but are desktop-app files — treat as out of scope unless the user explicitly includes them.
- **Test baseline** — `cd apps/web && npm test` must remain green (143/143) after changes.

## Standard Stack

No new dependencies are introduced by this phase. The rename uses only existing tooling.

### Supporting (already installed)
| Tool | Version | Purpose |
|------|---------|---------|
| react-i18next | existing | i18n key resolution; rename string values in JSON locale files |
| zustand | 5.x | Persist middleware; rename the `name` key in persist config |
| vitest | 4.x | Test runner for post-rename verification |

## Runtime State Inventory

This is a rename/refactor phase. All five categories answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage` key `'aperant-auth'` written by Zustand persist in `auth-store.ts` and read by `api-client.ts` | Code edit — rename key to `'currents-auth'` in both files. Side-effect: all logged-in browser sessions will be silently logged out on next load (acceptable; JWT sessions are short-lived). No data migration possible/needed — browser storage is per-user ephemeral state. |
| Live service config | None — no external services store "Aperant" as a config value. The Turso DB name and Vercel project name are user-controlled infrastructure outside this codebase. | None |
| OS-registered state | None — this is a web app; no OS-level registrations exist. | None |
| Secrets/env vars | `TURSO_DATABASE_URL` may contain `aperant` in the actual Turso DB URL (e.g., `libsql://aperant-xxx.turso.io`) — but this URL is set by the user in Vercel env vars, not in this codebase. The `.env.example` contains only a placeholder `libsql://your-db-name.turso.io`. | None — code change does not touch env var names or values. User chooses whether to rename their Turso DB separately. |
| Build artifacts | `apps/web/dist/` directory may contain compiled files with "Aperant" strings baked in from the old build. `dev.db` (SQLite) contains no Aperant strings in schema or data. `package-lock.json` references `@aperant/web` as a workspace package name — this auto-regenerates when `package.json` name changes and `npm install` runs. | Run `npm install` in `apps/web/` after renaming `package.json` to regenerate lockfile. The `dist/` directory is gitignored and rebuilt on deploy — no action needed. |

## Complete Rename Inventory (apps/web/ scope)

### Category A — Package name (1 change)

| File | Current Value | Target Value | Notes |
|------|--------------|--------------|-------|
| `apps/web/package.json` | `"name": "@aperant/web"` | `"name": "@currents/web"` | Monorepo workspace name; no external consumers in this repo |

After this change: run `cd apps/web && npm install` to regenerate `package-lock.json` workspace entries automatically. [VERIFIED: npm workspace docs pattern — ASSUMED package-lock auto-updates on install]

### Category B — Runtime localStorage key (2 changes — same key, two files)

| File | Current Value | Target Value | Side-Effect |
|------|--------------|--------------|-------------|
| `apps/web/src/client/stores/auth-store.ts:64` | `{ name: 'aperant-auth' }` | `{ name: 'currents-auth' }` | Users logged out on next page load |
| `apps/web/src/client/lib/api-client.ts:10` | `localStorage.getItem('aperant-auth')` | `localStorage.getItem('currents-auth')` | Must match auth-store.ts value exactly |

These two values MUST be identical. The Zustand `persist` middleware writes to `localStorage['aperant-auth']`; the `api-client.ts` manually reads the same key to extract the JWT for API calls. If they diverge, auth will silently break.

[VERIFIED: confirmed by reading both files directly]

### Category C — i18n display strings (6 changes across 6 files)

| File | Key Path | Current Value | Target Value |
|------|----------|--------------|--------------|
| `apps/web/src/shared/i18n/locales/en/common.json` | `appName` | `"Aperant"` | `"Currents"` |
| `apps/web/src/shared/i18n/locales/fr/common.json` | `appName` | `"Aperant"` | `"Currents"` |
| `apps/web/src/shared/i18n/locales/en/auth.json` | `welcome` | `"Welcome to Aperant"` | `"Welcome to Currents"` |
| `apps/web/src/shared/i18n/locales/fr/auth.json` | `welcome` | `"Bienvenue sur Aperant"` | `"Bienvenue sur Currents"` |
| `apps/web/src/shared/i18n/locales/en/settings.json` | `subtitle` | `"Configure your Aperant workspace"` | `"Configure your Currents workspace"` |
| `apps/web/src/shared/i18n/locales/fr/settings.json` | `subtitle` | `"Configurer votre espace de travail Aperant"` | `"Configurer votre espace de travail Currents"` |

"Currents" is not a French word; it is used as a proper noun (brand name) and stays as-is in French locale — same as how product names like "Slack" or "GitHub" remain unchanged across languages. [ASSUMED — standard brand localization practice]

### Category D — HTML page title (1 change)

| File | Current Value | Target Value |
|------|--------------|--------------|
| `apps/web/index.html` | `<title>Auto Claude — Multi-Product Backlog</title>` | `<title>Currents</title>` |

The existing title "Auto Claude" is the old desktop app name. The web app is "Currents". The subtitle "Multi-Product Backlog" is now outdated (it's a triage tool). Simplest correct title: `Currents`. [ASSUMED — planner may prefer `Currents — GitHub Issues & Triage` or similar; leaving choice open]

### Category E — CSS developer comment (1 change)

| File | Current Value | Target Value |
|------|--------------|--------------|
| `apps/web/src/client/styles/globals.css:4` | `/* Aperant Web - Design System */` | `/* Currents - Design System */` |

Comment only; no runtime effect. [VERIFIED: line 4 of globals.css confirmed]

### Category F — Documentation files (many occurrences, 2 files)

| File | Occurrences | Change Strategy |
|------|-------------|-----------------|
| `apps/web/README.md` | 8 occurrences | Replace all "Aperant" → "Currents"; update Turso DB name examples from `aperant` → `currents`; update architecture description to remove reference to "desktop app" |
| `apps/web/SPEC.md` | 5 occurrences | Replace all "Aperant" → "Currents"; update Turso DB name examples from `aperant-web` → `currents` |

README.md also contains references to OTP auth flows (now replaced by GitHub OAuth) and the outdated "Coming Soon" section. The phase should update these incidentally — but the planner should decide whether to scope README content refresh to this phase or a future cleanup phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Finding all occurrences | Manual file-by-file grep | The complete inventory above is already compiled; execute file edits directly |
| i18n string synchronization | Custom sync script | Edit both `en/` and `fr/` locale files directly as part of the same task |

## Architecture Patterns

### Pattern: Paired localStorage key rename

Both files that reference `'aperant-auth'` must be updated in the same atomic commit. If `auth-store.ts` writes `currents-auth` but `api-client.ts` still reads `aperant-auth`, the API client will silently return `null` tokens — every API call will return 401 and users will see the login screen.

```typescript
// auth-store.ts — Zustand persist writes this key
persist(
  (set, get) => ({ ... }),
  { name: 'currents-auth' }   // ← must match api-client.ts read
)

// api-client.ts — manually reads same key
const raw = localStorage.getItem('currents-auth');   // ← must match auth-store.ts name
```

[VERIFIED: confirmed by reading both files]

### Pattern: i18n brand name in French

The French `appName` value should remain `"Currents"` (proper noun, no translation). French UI copy that references it as a product name ("Bienvenue sur Currents", "espace de travail Currents") follows the same pattern used by major software brands.

## Common Pitfalls

### Pitfall 1: localStorage key mismatch
**What goes wrong:** `auth-store.ts` and `api-client.ts` get out of sync — one says `aperant-auth`, the other says `currents-auth`.
**Why it happens:** Two files reference the same magic string independently rather than sharing a constant.
**How to avoid:** Update both in the same task. After the change, run `grep -rn "aperant-auth" apps/web/src/` — must return zero results.
**Warning signs:** `npm test` passes (no tests cover localStorage key names), but manual smoke test shows 401 errors on API calls.

### Pitfall 2: package-lock.json drift
**What goes wrong:** `package-lock.json` still references `@aperant/web` after `package.json` name change. This doesn't break anything at runtime but causes confusion and stale workspace resolution.
**Why it happens:** Lockfile doesn't auto-regenerate without an explicit `npm install`.
**How to avoid:** Run `cd apps/web && npm install` after editing `package.json`. The lockfile diff will show the workspace name change.

### Pitfall 3: Forgetting the French locale
**What goes wrong:** English locale updated; French locale still says "Aperant". French-speaking users see inconsistent branding.
**Why it happens:** Developers forget both locales exist.
**How to avoid:** The 6 i18n changes (3 en + 3 fr) should be a single task. Post-change: `grep -rn "Aperant" apps/web/src/shared/i18n/` must return zero results.

### Pitfall 4: Out-of-scope creep into apps/desktop/
**What goes wrong:** Someone updates `apps/desktop/` files during this phase.
**Why it happens:** The grep results show many desktop files with "Aperant" — tempting to fix them too.
**How to avoid:** Explicitly scope all tasks to `apps/web/` only. `apps/desktop/` is not this project's scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `apps/web/vite.config.ts` (test projects section) |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| No "Aperant" strings remaining in apps/web/src/ | grep assertion | `grep -rn "Aperant" apps/web/src/ && echo FAIL || echo PASS` | Smoke check, not a vitest test |
| localStorage key consistency | manual | inspect api-client.ts + auth-store.ts | No automated test exists for localStorage key names |
| i18n files parse as valid JSON | vitest/manual | `cd apps/web && npm test` | If JSON is malformed, imports will fail and tests will error |
| Test suite remains green | full suite | `cd apps/web && npm test` | 143 tests must remain green |

### Wave 0 Gaps
None — this phase requires no new test files. The rename is verified by:
1. `grep -rn "Aperant" apps/web/src/` returning zero results
2. `npm test` remaining green

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a code/documentation-only rename phase)

## Security Domain

Step skipped — no new authentication, authorization, input handling, cryptography, or session management is introduced. This phase only renames string literals.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Currents" stays as-is in French locale (not translated) | Category C, CSS comment | Low — brand names are standard proper nouns; only affects aesthetics |
| A2 | HTML title should be simplified to just `Currents` | Category D | Low — planner can choose a longer subtitle; no functional impact |
| A3 | `apps/desktop/` is out of scope for this phase | Scope | Medium — if user intended desktop rename too, plan must add those files |
| A4 | `package-lock.json` will auto-update after `npm install` | Category A | Low — standard npm workspace behaviour; verified conceptually |

## Open Questions (RESOLVED)

1. **HTML title subtitle** — RESOLVED: Title set to `Currents` (Plan 08-01 Task 2)
   - What we know: Current title is "Auto Claude — Multi-Product Backlog" (wrong on both counts)
   - What's unclear: Should the title be just "Currents" or "Currents — GitHub Issues & Triage" or something else?
   - Recommendation: Default to `Currents` (simplest); user can override during planning

2. **README.md content refresh scope** — RESOLVED: Brand rename + outdated description update only; not a full rewrite (Plan 08-02 Task 2)
   - What we know: README.md references OTP auth (now removed), "Coming Soon" features that are done, and desktop app references
   - What's unclear: Should README be fully refreshed to reflect current state, or just name-swapped?
   - Recommendation: Do a full content refresh in this phase since the rename requires touching every paragraph anyway; but mark this as discretionary if the user wants a minimal change set

3. **apps/desktop/ scope** — RESOLVED: Both plans scoped to `apps/web/` only; desktop files excluded (Plans 08-01, 08-02)
   - What we know: PROJECT.md says `apps/desktop/` is out of this project's scope
   - What's unclear: Does the user want desktop files renamed as a secondary task in this phase?
   - Recommendation: Default to apps/web/ only; user can confirm if desktop should be included

## Sources

### Primary (HIGH confidence)
- Direct file reads of all affected files in apps/web/ — content verified in this session
- `grep -ri "aperant" apps/web/` — complete occurrence inventory generated in this session
- `cd apps/web && npm test` — baseline test run confirmed 143/143 green in this session

### Secondary (MEDIUM confidence)
- CLAUDE.md engineering principles — project scope rules for apps/web/ and i18n requirements
- PROJECT.md — explicit statement that apps/desktop/ is out of scope

### Tertiary (LOW confidence)
- A1: Brand name localization convention (not translated as proper noun) — based on training knowledge of industry norms

## Metadata

**Confidence breakdown:**
- Rename inventory: HIGH — all occurrences verified by direct grep and file reads
- Runtime state: HIGH — localStorage key and its two consumers both verified by reading source
- Scope boundary: HIGH — PROJECT.md explicitly defines apps/web/ as active scope
- i18n behaviour: HIGH — all 6 locale files read directly

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable codebase; only changes if new "Aperant" references are introduced)
