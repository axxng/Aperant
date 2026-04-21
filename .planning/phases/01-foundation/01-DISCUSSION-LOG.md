# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 01-foundation
**Areas discussed:** Rate-limit error shape, Triage GET missing record, Issues proxy label format, comment_status values

---

## Rate-limit error shape

| Option | Description | Selected |
|--------|-------------|----------|
| Seconds-until-retry | `{ error: 'rate_limited', retryAfter: 3600 }` — client converts to display text | ✓ |
| ISO timestamp | `{ error: 'rate_limited', retryAt: '<ISO string>' }` — client formats to local time | |
| Pre-formatted message | `{ error: 'rate_limited', message: 'Retry at 15:00 UTC.' }` — couples formatting to server | |

**User's choice:** Seconds-until-retry
**Notes:** Clean separation — server parses headers, client formats message for its locale.

Follow-up: Should 429 and rate-limit 403 use the same shape?

| Option | Selected |
|--------|----------|
| Yes, unified shape | ✓ |
| Distinguish primary vs secondary | |

**User's choice:** Unified — client doesn't need to distinguish.

---

## Triage GET missing record

| Option | Description | Selected |
|--------|-------------|----------|
| 200 with default state | Always return `{ isTriaged: false, priority: null, ... }` | ✓ |
| 404 not found | Return 404 when no record exists | |

**User's choice:** 200 with default state
**Notes:** Simplifies Phase 4 React code — no 404 branch to handle.

Follow-up: Should PUT be upsert or require a prior record?

| Option | Selected |
|--------|----------|
| Upsert (create or update) | ✓ |
| Create-then-update (two calls) | |

**User's choice:** Upsert

---

## Issues proxy label format

| Option | Description | Selected |
|--------|-------------|----------|
| Comma-separated string | `labels=bug,feature` — GitHub-native, pass-through | ✓ |
| Array-style params | `labels[]=bug&labels[]=feature` — requires server join | |

**User's choice:** Comma-separated string
**Notes:** Matches GitHub's API format; no server-side transformation needed.

---

## comment_status values

| Option | Description | Selected |
|--------|-------------|----------|
| NULL / posted / failed | NULL = not posted, posted = confirmed, failed = errored | ✓ |
| pending / posted / failed | Adds pending state for async flows | |

**User's choice:** NULL / posted / failed
**Notes:** POST is synchronous — no intermediate pending state needed. `failed` allows user retry.

---

## Claude's Discretion

- Internal structure of `GitHubRateLimitError` class
- Auth middleware wiring in triage routes
- Whether triage migration is inline in `client.ts` or separate

## Deferred Ideas

None
