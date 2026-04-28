# Quick Task 260423-etk: document about mock local api server - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Task Boundary

Write documentation for the mock local API server used in `apps/web/` development. The mock system gates behind `MOCK_SERVICES=true` and provides a full local dev workflow without real Turso DB, GitHub OAuth, or GitHub API credentials.

</domain>

<decisions>
## Implementation Decisions

### Documentation location
- Target file: `apps/web/README.md` (add a "Local Development" section)
- If the file doesn't exist, create it

### Coverage depth
- Quick-start (env setup, seed command, start command) + all mock endpoints with request/response examples + troubleshooting section

### Endpoint documentation style
- Enumerate every intercepted `/api/*` route with: HTTP method, path, fixture data shape, and notes on behaviour differences vs. the real API

### Claude's Discretion
- Exact section headings and formatting style within the README
- Order of sections within the doc (quick-start first, then endpoints, then troubleshooting)
- Whether to include a brief architecture explainer paragraph before the endpoint table

</decisions>

<specifics>
## Specific Ideas

- Source of truth for mock routes: `apps/web/scripts/mocks/github-fixtures.ts` and `apps/web/api/_lib/db/client.ts`
- Env vars to document: `MOCK_SERVICES`, `VITE_MOCK_SERVICES`, `JWT_SECRET`
- Commands: `npx tsx scripts/seed.ts`, `npx tsx scripts/dev-server.ts`

</specifics>

<canonical_refs>
## Canonical References

- CLAUDE.md Section 5 "Mocked Services for Dev Env" — already has the canonical pattern and env-var table; new README should be consistent with it
- `apps/web/scripts/mocks/github-fixtures.ts` — source of mock GitHub API routes
- `apps/web/scripts/dev-server.ts` — the mock dev server entrypoint

</canonical_refs>
