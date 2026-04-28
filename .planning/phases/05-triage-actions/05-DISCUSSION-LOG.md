# Phase 5: Triage Actions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 05-triage-actions
**Areas discussed:** Triage controls placement, Priority selector UX, Triaged badge on list row, Keyboard nav scope

---

## Triage Controls Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated triage section at top | Compact triage row pinned just below title/number, before labels/body. Best for fast triage sessions. | ✓ |
| Inline below header | Triage controls mixed into meta section alongside labels, assignees, date. More compact, less distinct. | |
| Fixed footer at bottom | Triage controls sticky at bottom of panel — always visible while scrolling body. | |

**User's choice:** Dedicated triage section at top
**Notes:** Controls appear immediately on panel open, before the issue body. Layout: `[✓ Triaged] [Priority: ▾]` row between title and labels/meta.

---

## Priority Selector UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown / Select | Compact trigger showing current priority, opens dropdown with Critical/High/Medium/Low/Clear options. | ✓ |
| Inline button group | Four compact buttons [C][H][M][L] side-by-side; active priority highlighted. Wider, requires color coding. | |

**User's choice:** Dropdown / Select
**Notes:** Includes a "Clear" option to remove priority. Shows current priority in trigger (e.g., "Priority: High ▾"). Falls back to "Priority: None ▾" when unset.

---

## Triaged Badge on List Row

| Option | Description | Selected |
|--------|-------------|----------|
| Checkmark icon + priority pill | ✓ icon when triaged + priority-colored pill (e.g., [High]) when priority is set. Scannable at a glance. | ✓ |
| Priority-colored left border | 2-3px left border in priority color. No separate triaged indicator. Cleaner but less explicit. | |
| Muted text + check | Triaged rows get muted text + ✓ at end. Priority only in tooltip. Minimal visual change. | |

**User's choice:** Checkmark icon + priority pill
**Notes:** `[High]✓` for triaged + priority; `[High]` alone for priority-only; nothing extra for untouched issues. Priority colors: Critical=red, High=orange, Medium=yellow, Low=blue/gray.

---

## Keyboard Nav Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Panel-open only, auto-navigates | j/k activates when panel is open; moves to next/prev issue AND auto-updates panel. Matches GitHub's own UX. | ✓ |
| Always active in list | j/k works with or without panel open; moves list cursor. Enter opens panel. | |

**User's choice:** Panel-open only, auto-navigates
**Notes:** When panel is closed, j/k do nothing. When open, j/k auto-scroll to and display next/prev issue in the currently visible filtered list.

---

## Claude's Discretion

- Exact Radix component for priority selector (DropdownMenu vs Select)
- Whether triage state is fetched inside `IssueDetailPanel` or passed as prop from parent
- Animation for triage section
- Exact priority color tokens (must work in light + dark themes)
- ✓ icon implementation (lucide-react vs styled character)

## Deferred Ideas

- Batch triage (TRIAGE-V2-02) — deferred to v2
- Snooze with wake-up date (TRIAGE-V2-01) — deferred to v2
- List-mode j/k navigation (without panel open) — deferred; simple if needed later
