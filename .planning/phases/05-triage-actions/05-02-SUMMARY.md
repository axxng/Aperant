---
phase: 05-triage-actions
plan: "02"
subsystem: web/frontend-components
tags: [triage, i18n, TriageBadgeSlot, IssueListRow, green-phase]
dependency_graph:
  requires: [05-01]
  provides: [TRIAGE-04-green, triage-i18n-en, triage-i18n-fr]
  affects: [IssueListRow.tsx, en/issues.json, fr/issues.json]
tech_stack:
  added: []
  patterns: [lucide-react-icons, priority-pill-classes, optional-prop-pattern]
key_files:
  created: []
  modified:
    - apps/web/src/client/components/IssueListRow.tsx
    - apps/web/src/shared/i18n/locales/en/issues.json
    - apps/web/src/shared/i18n/locales/fr/issues.json
decisions:
  - "Priority pill text is capitalized in-component (charAt(0).toUpperCase() + slice(1)) rather than via i18n keys — keeps the pill self-contained and avoids t() call in the pill span"
  - "TriageStateDisplay interface defined locally in IssueListRow.tsx (not exported) — only IssueListRow needs it; shared type export deferred to Plan 05-03 if IssueDetailPanel needs to reuse it"
  - "PRIORITY_PILL_CLASSES as module-level Record constant — pure lookup, no runtime logic, easily extended"
metrics:
  duration: "1m 13s"
  completed_date: "2026-04-22"
  tasks_completed: 1
  files_changed: 3
requirements:
  - TRIAGE-04
---

# Phase 05 Plan 02: TriageBadgeSlot + i18n Keys Summary

**One-liner:** IssueListRow extended with TriageBadgeSlot (CheckCircle2 checkmark + priority pill) and complete triage i18n keys added to EN and FR locale files.

## What Was Built

Wave 1a: Added the TriageBadgeSlot rendering slot to `IssueListRow` and populated all triage i18n keys needed by Wave 1 plans (05-02, 05-03, 05-04).

### IssueListRow.tsx changes

- `import { CheckCircle2 } from 'lucide-react'` added
- `TriageStateDisplay` interface: `{ isTriaged: boolean; priority: 'critical' | 'high' | 'medium' | 'low' | null }`
- `triageState?: TriageStateDisplay` optional prop added to `IssueListRowProps`
- `PRIORITY_PILL_CLASSES` module-level Record constant maps priority → Tailwind color classes
- TriageBadgeSlot JSX: conditionally renders priority pill and/or CheckCircle2 based on triageState values

### i18n changes (EN + FR)

Both `en/issues.json` and `fr/issues.json` received a `"triage"` key block with 13 leaf values:
`markTriaged`, `markTriagedAriaLabel`, `triaged`, `triagedAriaLabel`, `priorityNone`, `prioritySet`, `priorityAriaLabel`, `priorityClear`, `closedWarning`, `saveError`, and nested `priority.{critical,high,medium,low}`.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add TriageBadgeSlot to IssueListRow and triage i18n keys | `0e51001c` |

## Verification

```
Test Files  1 passed (1)
Tests       8 passed (8)  ← 3 CROSS-02 + 5 TRIAGE-04
```

All 5 TRIAGE-04 tests now pass green:
- `renders checkmark icon when triageState.isTriaged=true and no priority` — PASS
- `renders priority pill with capitalized text when priority is set and not triaged` — PASS
- `renders both priority pill and checkmark when triaged with priority` — PASS
- `renders no triage badge when triageState prop is absent` — PASS
- `renders no triage badge when isTriaged=false and priority=null` — PASS

i18n completeness: `grep -c '"triage"' en/issues.json` → `1`, `grep -c '"triage"' fr/issues.json` → `1`

TypeScript: No errors in `IssueListRow.tsx` (pre-existing errors in IssueDetailPanel.test.tsx from Wave 0 are out of scope).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all TriageBadgeSlot rendering paths are fully implemented.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

Files modified:
- FOUND: apps/web/src/client/components/IssueListRow.tsx (contains TriageStateDisplay, triageState prop, PRIORITY_PILL_CLASSES, TriageBadgeSlot JSX)
- FOUND: apps/web/src/shared/i18n/locales/en/issues.json (contains "triage" key block)
- FOUND: apps/web/src/shared/i18n/locales/fr/issues.json (contains "triage" key block with French values)

Commits verified:
- FOUND: 0e51001c
