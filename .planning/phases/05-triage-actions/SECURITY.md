# SECURITY.md — Phase 05: triage-actions

**Audited:** 2026-04-22
**ASVS Level:** 1
**Threats Total:** 10
**Threats Closed:** 10
**Threats Open:** 0

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-01 | Tampering | accept | CLOSED | `triagePutBodySchema.safeParse(req.body)` at line 52 + `authenticateRequest` at line 32 in `apps/web/api/triage/[owner]/[repo]/[number].ts`. Surface unchanged from Phase 1; no new attack surface introduced in Phase 5. |
| T-05-02 | Tampering (XSS) | accept | CLOSED | No `dangerouslySetInnerHTML` usage in `IssueDetailPanel.tsx` or `IssuesView.tsx`. Issue title rendered via React text node (`issue.title` inside JSX). ReactMarkdown used for issue body (with remark-gfm) — standard safe rendering. |
| T-05-03 | Elevation of Privilege | mitigate | CLOSED | Guard present at `IssuesView.tsx:182`: `if (target.tagName === 'INPUT' \|\| target.tagName === 'TEXTAREA' \|\| target.isContentEditable) return;` — blocks j/k hijacking from form elements. Test TRIAGE-05f in `IssuesView.test.tsx` enforces this. |
| T-05-04 | Denial of Service | mitigate | CLOSED | `IssueDetailPanel.tsx:217`: `triageMutation.mutate({ priority: null, owner, repo, number: issue!.number })` — explicit `priority: null` always sent. Field is never omitted. Schema `triagePutBodySchema` in the server handler accepts null explicitly. |
| T-05-05-01 | Tampering | accept | CLOSED | `owner`, `repo`, `number` in mutation variables originate from `GitHubIssue` object fetched via authenticated GitHub API. Validated at fetch boundary via `gitHubApiPRSchema`/GitHub API response parsing. No user-supplied override possible. |
| T-05-05-02 | Spoofing | accept | CLOSED | Mock state filter in `github-fixtures.ts` is gated behind `registerMockRoutes()` which is only called when `MOCK_SERVICES=true`. This env-var must not be set in production (documented in CLAUDE.md principle 5). Not reachable in production. |
| T-05-05-03 | DoS | accept | CLOSED | `setSelectedIssueId(null)` on already-null state is a React no-op (state setter with same value triggers no re-render). No loop risk from repeated Escape key presses. |
| T-05-06-01 | Tampering | mitigate | CLOSED | `apps/web/api/triage/[owner]/[repo].ts:9-13`: `batchQuerySchema` validates `numbers` with regex `/^\d+(,\d+)*$/` ensuring only comma-separated positive integers are accepted. `z.safeParse()` used at line 29 → returns 400 on failure. |
| T-05-06-02 | Information Disclosure | mitigate | CLOSED | `apps/web/api/triage/[owner]/[repo].ts:39`: `authenticateRequest(req, res)` called before any DB query. Unauthenticated callers receive 401 (middleware handles response and returns falsy). |
| T-05-06-03 | Denial of Service | mitigate | CLOSED | `apps/web/api/triage/[owner]/[repo].ts:36`: `issueNumbers.slice(0, 100)` hard-caps the array to 100 items before passing to `getTriageRecordsBatch`. SQL IN clause is bounded even if regex allows longer input (defence in depth). |

---

## Accepted Risks Log

| Threat ID | Accepted Risk | Rationale |
|-----------|--------------|-----------|
| T-05-01 | PUT /api/triage route tampering | Mitigated in Phase 1: schema validation + auth already in place; no new surface. |
| T-05-02 | XSS via issue.title | React renders string props as text nodes by default; no `dangerouslySetInnerHTML` usage confirmed in scope files. |
| T-05-05-01 | Mutation variable tampering | Values sourced from server-authenticated GitHub API response; already validated at fetch boundary. |
| T-05-05-02 | Mock state filter spoofing | Mock env only; `MOCK_SERVICES=true` must not be set in production (per CLAUDE.md engineering principle 5). |
| T-05-05-03 | Escape key DoS loop | React state setter with same value is a no-op; no risk. |

---

## Unregistered Threat Flags

None. The threat flag in `05-06-SUMMARY.md` (`input-validation` on `api/triage/[owner]/[repo].ts`) maps directly to registered threats T-05-06-01, T-05-06-02, and T-05-06-03, all of which are CLOSED. No unregistered flags remain.
