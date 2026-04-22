# Phase 7: Promote to Backlog — Context

**Gathered:** (run /gsd-discuss-phase 7 to populate)
**Status:** Ready for planning

> **Note:** This directory was originally created for the "GitHub OAuth Login" phase before it was moved to Phase 3.
> The context below covers the actual Phase 7 scope: promoting GitHub issues to Currents backlog tasks.

## Phase Goal

Users can promote a GitHub issue to a Currents backlog task in one action, with the task staying live-synced to the issue and all promotion safeguards in place.

## Requirements

- **PROMOTE-01:** User can promote a GitHub issue to a Currents backlog task from the triage panel in a single action
- **PROMOTE-02:** Edits to the promoted task in Currents write back to the GitHub issue via the existing write-back mechanism automatically
- **PROMOTE-03:** An already-promoted issue shows a "View in Backlog" badge linking to the Kanban task instead of the promote button
- **PROMOTE-04:** When promoting, the issue's internal triage priority pre-populates the task priority field
- **PROMOTE-05:** Attempting to promote the same GitHub issue a second time is blocked with a clear message — no duplicate tasks are created

## Depends On

Phase 5 (Triage Actions), Phase 6 (Notes)

## Context

(Run `/gsd-discuss-phase 7` to gather implementation decisions before planning)
