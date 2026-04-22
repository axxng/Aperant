---
phase: 05
slug: triage-actions
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-22
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → API | All triage mutations (PUT /api/triage) cross this boundary; user input is priority string or boolean | Priority enum / null |
| API → DB | Triage record upsert; hardened in Phase 1 | Priority enum |
| client → batch API | `numbers` query param is user-controlled; validated before use in SQL | Comma-separated positive integers |
| mock handler → filter | req.query.state is user-controlled query param; only used in mock env (MOCK_SERVICES=true) | String enum (dev only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-05-01 | Tampering | PUT /api/triage route | accept | `triagePutBodySchema.safeParse(req.body)` + `authenticateRequest` in `api/triage/[owner]/[repo]/[number].ts`; carried forward from Phase 1, no new surface | closed |
| T-05-02 | Tampering | XSS via issue.title in triage UI | accept | React renders issue.title as text node (no `dangerouslySetInnerHTML`); safe by framework default | closed |
| T-05-03 | Elevation of Privilege | j/k keyboard hijacking input fields | mitigate | Guard at `IssuesView.tsx:182`: `if (target.tagName === 'INPUT' \|\| target.tagName === 'TEXTAREA' \|\| target.isContentEditable) return` | closed |
| T-05-04 | Denial of Service | Priority clear sends `priority: null` vs omit | mitigate | `IssueDetailPanel.tsx:217`: explicit `{ priority: null }` always sent — field never omitted | closed |
| T-05-05-01 | Tampering | mutation variables (owner/repo/number) | accept | Values originate from authenticated GitHub API response; validated at fetch boundary — not user-supplied | closed |
| T-05-05-02 | Spoofing | mock state filter in github-fixtures.ts | accept | Only reachable when `MOCK_SERVICES=true`; `registerMockRoutes()` gate ensures prod isolation | closed |
| T-05-05-03 | DoS | Escape key handler firing repeatedly | accept | `setSelectedIssueId(null)` on already-null state is a React no-op; no re-render loop possible | closed |
| T-05-06-01 | Tampering | GET /api/triage/:owner/:repo `numbers` param | mitigate | `batchQuerySchema` regex `/^\d+(,\d+)*$/` + `z.safeParse()` → 400 at `api/triage/[owner]/[repo].ts:9-13,29` | closed |
| T-05-06-02 | Information Disclosure | Batch endpoint returns triage records for any repo | mitigate | `authenticateRequest(req, res)` at line 39 before DB query; unauthenticated callers receive 401 | closed |
| T-05-06-03 | Denial of Service | Large `numbers` list causes expensive IN query | mitigate | `.slice(0, 100)` hard-cap at `api/triage/[owner]/[repo].ts:36` before `getTriageRecordsBatch` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-01 | PUT /api/triage already hardened in Phase 1; no new attack surface introduced in Phase 5 | gsd-security-auditor | 2026-04-22 |
| AR-05-02 | T-05-02 | React framework renders text as DOM text nodes by default; XSS requires explicit `dangerouslySetInnerHTML` which is not present | gsd-security-auditor | 2026-04-22 |
| AR-05-03 | T-05-05-01 | owner/repo/number values originate from authenticated GitHub API response, validated at API fetch boundary | gsd-security-auditor | 2026-04-22 |
| AR-05-04 | T-05-05-02 | Mock filter unreachable in production — gated by MOCK_SERVICES=true env var | gsd-security-auditor | 2026-04-22 |
| AR-05-05 | T-05-05-03 | React state setter called with same value is a no-op — no risk of loop or excessive re-renders | gsd-security-auditor | 2026-04-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-22 | 10 | 10 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-22
