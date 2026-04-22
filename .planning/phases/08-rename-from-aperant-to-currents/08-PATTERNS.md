# Phase 8: Rename from Aperant to Currents — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 13
**Analogs found:** 13 / 13 (all files are direct edits of existing files — no new files created)

## File Classification

| Modified File | Role | Data Flow | Change Type | Match Quality |
|---------------|------|-----------|-------------|---------------|
| `apps/web/package.json` | config | — | string substitution | self (edit-in-place) |
| `apps/web/src/client/stores/auth-store.ts` | store | request-response | string substitution (line 64) | self (edit-in-place) |
| `apps/web/src/client/lib/api-client.ts` | utility | request-response | string substitution (line 10) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/en/common.json` | config | — | string substitution (line 2) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/fr/common.json` | config | — | string substitution (line 2) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/en/auth.json` | config | — | string substitution (line 4) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/fr/auth.json` | config | — | string substitution (line 4) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/en/settings.json` | config | — | string substitution (line 3) | self (edit-in-place) |
| `apps/web/src/shared/i18n/locales/fr/settings.json` | config | — | string substitution (line 3) | self (edit-in-place) |
| `apps/web/index.html` | config | — | string substitution (line 6) | self (edit-in-place) |
| `apps/web/src/client/styles/globals.css` | config | — | comment substitution (line 4) | self (edit-in-place) |
| `apps/web/README.md` | documentation | — | bulk text substitution | self (edit-in-place) |
| `apps/web/SPEC.md` | documentation | — | bulk text substitution | self (edit-in-place) |

Note: Every file in this phase is an in-place edit of an existing file. There are no new files to create. The "analog" for every file is the file itself — the planner should read the current state (shown in excerpts below) and apply the targeted substitution.

## Pattern Assignments

### `apps/web/package.json` (config)

**Change:** Line 2 — rename package name.

**Current state** (line 1-3):
```json
{
  "name": "@aperant/web",
  "version": "0.1.0",
```

**Target state** (line 1-3):
```json
{
  "name": "@currents/web",
  "version": "0.1.0",
```

**Post-edit action required:** Run `cd apps/web && npm install` to regenerate `package-lock.json` workspace entries. This is the only file in the phase that requires a follow-up command.

---

### `apps/web/src/client/stores/auth-store.ts` (store, request-response)

**Change:** Line 64 — rename Zustand persist key.

**Current state** (lines 63-65):
```typescript
      },
      { name: 'aperant-auth' }
    ),
```

**Target state** (lines 63-65):
```typescript
      },
      { name: 'currents-auth' }
    ),
```

**Critical constraint:** This value MUST match the `localStorage.getItem()` key in `api-client.ts` exactly. Both files reference the same magic string — they must be updated in the same atomic change. If they diverge, every API call will return 401.

**Known side-effect:** Renaming this key will silently log out all currently-authenticated browser sessions on their next page load. The old `aperant-auth` key will remain orphaned in localStorage but will never be read again. This is acceptable — JWT sessions are short-lived.

---

### `apps/web/src/client/lib/api-client.ts` (utility, request-response)

**Change:** Line 10 — rename localStorage key read.

**Current state** (lines 8-16):
```typescript
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('aperant-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}
```

**Target state** (lines 8-16):
```typescript
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('currents-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}
```

**Critical constraint:** Must match `auth-store.ts` persist `name` field exactly. Update both files in the same commit.

---

### `apps/web/src/shared/i18n/locales/en/common.json` (config)

**Change:** Line 2 — rename `appName` value.

**Current state** (line 2):
```json
  "appName": "Aperant",
```

**Target state** (line 2):
```json
  "appName": "Currents",
```

---

### `apps/web/src/shared/i18n/locales/fr/common.json` (config)

**Change:** Line 2 — rename `appName` value.

**Current state** (line 2):
```json
  "appName": "Aperant",
```

**Target state** (line 2):
```json
  "appName": "Currents",
```

**Brand name note:** "Currents" is used as a proper noun (brand name) in French — it is not translated. This follows the same pattern used by brands like Slack and GitHub across languages.

---

### `apps/web/src/shared/i18n/locales/en/auth.json` (config)

**Change:** Line 4 — rename `welcome` string value.

**Current state** (line 4):
```json
  "welcome": "Welcome to Aperant",
```

**Target state** (line 4):
```json
  "welcome": "Welcome to Currents",
```

---

### `apps/web/src/shared/i18n/locales/fr/auth.json` (config)

**Change:** Line 4 — rename `welcome` string value.

**Current state** (line 4):
```json
  "welcome": "Bienvenue sur Aperant",
```

**Target state** (line 4):
```json
  "welcome": "Bienvenue sur Currents",
```

---

### `apps/web/src/shared/i18n/locales/en/settings.json` (config)

**Change:** Line 3 — rename `subtitle` string value.

**Current state** (line 3):
```json
  "subtitle": "Configure your Aperant workspace",
```

**Target state** (line 3):
```json
  "subtitle": "Configure your Currents workspace",
```

---

### `apps/web/src/shared/i18n/locales/fr/settings.json` (config)

**Change:** Line 3 — rename `subtitle` string value.

**Current state** (line 3):
```json
  "subtitle": "Configurer votre espace de travail Aperant",
```

**Target state** (line 3):
```json
  "subtitle": "Configurer votre espace de travail Currents",
```

---

### `apps/web/index.html` (config)

**Change:** Line 6 — replace `<title>` content.

**Current state** (line 6):
```html
    <title>Auto Claude — Multi-Product Backlog</title>
```

**Target state** (line 6):
```html
    <title>Currents</title>
```

**Note:** The existing title "Auto Claude — Multi-Product Backlog" is doubly wrong: "Auto Claude" is the old desktop app name, and "Multi-Product Backlog" is an outdated description. RESEARCH.md recommends simplifying to just `Currents`. The planner may opt for a subtitle like `Currents — GitHub Issues & Triage` — this is a discretionary decision.

---

### `apps/web/src/client/styles/globals.css` (config)

**Change:** Line 4 — update CSS developer comment.

**Current state** (line 4):
```css
/* Aperant Web - Design System */
```

**Target state** (line 4):
```css
/* Currents - Design System */
```

No runtime effect — comment only.

---

### `apps/web/README.md` (documentation)

**Change:** Bulk text substitution — replace all occurrences of "Aperant" with "Currents" and update Turso DB name examples from `aperant` to `currents`.

**Occurrence count:** 8 occurrences per RESEARCH.md grep inventory.

**Strategy:** Replace all `Aperant` → `Currents` and all `aperant` (in DB URL examples) → `currents`. RESEARCH.md also notes the README references OTP auth (now replaced by GitHub OAuth) and "Coming Soon" features that are now done — the planner should decide whether to do a full content refresh or a minimal name-swap only.

**Verification after edit:**
```bash
grep -n "Aperant\|aperant" apps/web/README.md
# Must return zero results
```

---

### `apps/web/SPEC.md` (documentation)

**Change:** Bulk text substitution — replace all occurrences of "Aperant" with "Currents" and Turso DB name examples from `aperant-web` to `currents`.

**Occurrence count:** 5 occurrences per RESEARCH.md grep inventory.

**Strategy:** Replace all `Aperant` → `Currents` and `aperant-web` (in DB URL examples) → `currents`.

**Verification after edit:**
```bash
grep -n "Aperant\|aperant" apps/web/SPEC.md
# Must return zero results
```

---

## Shared Patterns

### Paired localStorage key rename

**Apply to:** `auth-store.ts` (line 64) AND `api-client.ts` (line 10) — must be updated atomically.

The Zustand `persist` middleware writes to `localStorage['aperant-auth']`; the `api-client.ts` `getAuthToken()` function manually reads the same key to extract the JWT. These two string literals must always match. There is no shared constant — both are magic strings. Update both in a single task/commit.

```typescript
// auth-store.ts line 64 — Zustand persist config (writes the key)
{ name: 'currents-auth' }

// api-client.ts line 10 — manual localStorage read (reads the key)
const raw = localStorage.getItem('currents-auth');
```

**Post-change verification:**
```bash
grep -rn "aperant-auth" apps/web/src/
# Must return zero results
```

### i18n paired locale update

**Apply to:** All 6 locale JSON files (3 `en/` + 3 `fr/`).

Both language files for each namespace must be updated in the same task. CLAUDE.md mandates: "Add keys to both `en/*.json` and `fr/*.json`." Updating only English leaves French-speaking users with inconsistent branding.

Pairing:
- `en/common.json` line 2 + `fr/common.json` line 2
- `en/auth.json` line 4 + `fr/auth.json` line 4
- `en/settings.json` line 3 + `fr/settings.json` line 3

**Post-change verification:**
```bash
grep -rn "Aperant" apps/web/src/shared/i18n/
# Must return zero results
```

## No Analog Found

Not applicable — all 13 files are existing files being edited in-place. No new files are created in this phase.

## Post-Phase Verification Checklist

Run after all edits are complete:

```bash
# 1. No Aperant references remain in src/
grep -rn "Aperant\|aperant-auth" apps/web/src/
# Expected: zero results

# 2. Documentation files clean
grep -rn "Aperant" apps/web/README.md apps/web/SPEC.md
# Expected: zero results

# 3. package.json updated
grep '"name"' apps/web/package.json
# Expected: "@currents/web"

# 4. Regenerate lockfile after package.json rename
cd apps/web && npm install

# 5. Test suite remains green
cd apps/web && npm test
# Expected: 143/143 passing
```

## Metadata

**Analog search scope:** `apps/web/src/` (all 13 files are the analogs themselves)
**Files scanned:** 13 files read directly
**Pattern extraction date:** 2026-04-23
**Out of scope:** `apps/desktop/` — explicitly excluded per PROJECT.md
