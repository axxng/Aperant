# Codebase Concerns

**Analysis Date:** 2026-04-21

## Tech Debt

**Duplicate Events Module:**
- Issue: Two parallel implementations of events broadcast/query exist side by side. `api/_lib/events.ts` defines `broadcastEvent`, `getEventsSince` (seconds), and `purgeOldEvents(olderThanSeconds)`. `api/_lib/db/events.ts` defines `insertEvent`, `getEventsSince`, and `purgeOldEvents(olderThanMinutes)`. `api/_lib/broadcast.ts` is a thin wrapper that delegates to `db/events.ts` but is not used for broadcasts — most routes import directly from `api/_lib/events.ts`.
- Files: `apps/web/api/_lib/events.ts`, `apps/web/api/_lib/db/events.ts`, `apps/web/api/_lib/broadcast.ts`
- Impact: `purgeOldEvents` uses different units in the two modules (seconds vs. minutes). The cron job (`api/cron/sync.ts`) calls `purgeOldEvents(3600)` from `_lib/events.ts` (seconds), which correctly purges events older than 1 hour. However, if any caller inadvertently switches to the `db/events.ts` version, `purgeOldEvents(3600)` would purge events from the last 60 hours rather than 1 hour. Dead code in `_lib/broadcast.ts` adds confusion.
- Fix approach: Consolidate into one canonical module (`_lib/db/events.ts`), remove `_lib/broadcast.ts`, update imports in all routes, standardise units.

**Migration Numbering Gap:**
- Issue: The migrations array in `api/_lib/db/client.ts` jumps from `001_initial_schema` to `006_users`, skipping migrations 002–005. No explanation or comment exists for missing migration names.
- Files: `apps/web/api/_lib/db/client.ts` (lines 69–201)
- Impact: Makes schema history untrustworthy. Developers cannot tell whether migrations 002–005 existed and were consolidated, or were simply never written. Future developers adding a migration have no clear next sequence number to use.
- Fix approach: Add a comment block explaining the gap (e.g., whether earlier migrations were squashed). Establish a written convention for migration numbering.

**Serverless-Unsafe In-Process Migration Flag:**
- Issue: `ensureDb()` in `api/_lib/db/client.ts` uses a module-level `let migrated = false` flag to track whether migrations have run. In a Vercel serverless environment, each cold start is a fresh process, so the flag always starts as `false` — migrations are correctly re-checked via the `migrations` table on each cold start. However, the flag is also reset if the module is hot-reloaded during development, which can cause migrations to run twice per session.
- Files: `apps/web/api/_lib/db/client.ts` (lines 4–25)
- Impact: Low risk in production (idempotent `IF NOT EXISTS` SQL), but misleads developers about the real migration gate. The `migrations` table is the true idempotency guard; the flag is redundant.
- Fix approach: Remove the in-memory `migrated` flag and rely solely on the `migrations` table check, or clearly document why the in-memory flag exists alongside the DB check.

**`productId` Query Parameter Not Validated on `GET /api/tasks`:**
- Issue: `GET /api/tasks?productId=...` passes the raw query string `productId` directly to `getTasksByProduct(productId)` without UUID validation.
- Files: `apps/web/api/tasks/index.ts` (line 20-21)
- Impact: Arbitrary strings reach the SQL layer. Libsql uses parameterized queries, so SQL injection is not possible, but non-UUID values may cause confusing empty results and are inconsistent with other endpoints (e.g., `PATCH /api/tasks/[id]` validates UUID format explicitly).
- Fix approach: Add `uuidSchema.safeParse(productId)` before calling `getTasksByProduct`, return 400 on invalid format.

**`viewer` Role Defined But Never Enforced:**
- Issue: User creation accepts `viewer` as a valid role (`api/auth/users/index.ts` line 11, `api/auth/users/[id].ts` line 9). However, no API route calls `hasRole(user, 'viewer')` — every protected route only checks `admin` or `admin, member`. A `viewer` role user can create, update, and delete tasks like a `member`.
- Files: `apps/web/api/auth/users/index.ts`, `apps/web/api/auth/users/[id].ts`, `apps/web/api/_lib/auth/middleware.ts`
- Impact: Role-based access control is broken for `viewer` users — they have full write access. Any user created with the `viewer` role gets unintended write permissions.
- Fix approach: Implement viewer-specific checks in all write handlers (`POST /tasks`, `PATCH /tasks/[id]`, `DELETE /tasks/[id]`, `PATCH /products/[id]`, `DELETE /products/[id]`) or remove the `viewer` role until it is actually needed.

**Settings Store Stores `anthropicApiKey` in Frontend State Without Use:**
- Issue: `settings-store.ts` holds `anthropicApiKey` as a field and loads it from the API response. The Settings UI (`Settings.tsx`) does not expose an input for `anthropicApiKey` (only `githubToken`), and no client-side code uses this value. The API correctly masks it as `'••••••••'`, so the value in the store is always the masked string.
- Files: `apps/web/src/client/stores/settings-store.ts`, `apps/web/src/client/components/Settings.tsx`
- Impact: Dead state field. Suggests planned but incomplete Anthropic key management UI, or a leftover from removed functionality.
- Fix approach: Remove the `anthropicApiKey` field from the store if there is no UI or usage planned, or add the corresponding UI section.

## Known Bugs

**`gitlab_project` Source Type Accepted But Never Synced:**
- Symptoms: Users can create products with `type: 'gitlab_project'` source. Validation schema in `api/_lib/validation.ts` accepts it. However, the sync function `syncProduct()` in `api/_lib/sync/github-sync.ts` has no `case 'gitlab_project'` handler — the `default` branch returns an error result: `{ errors: ['Unknown source type'] }`.
- Files: `apps/web/api/_lib/validation.ts` (line 35), `apps/web/api/_lib/sync/github-sync.ts` (lines 130-153), `apps/web/src/shared/types/product.ts` (line 47)
- Trigger: Creating a product with a GitLab source type, then triggering a sync.
- Workaround: None. Sync silently fails with a generic error in the `SyncResult.errors` array.

## Security Considerations

**JWT Secret Falls Back to Random Value in Non-Vercel Environments:**
- Risk: When `JWT_SECRET` is not set and `VERCEL` env var is absent (local dev, staging, Docker), the JWT secret is generated from `crypto.randomBytes(32)` at module load time. Any process restart invalidates all existing tokens. If multiple server instances run without `JWT_SECRET`, each generates a different secret, making tokens from one instance invalid on others.
- Files: `apps/web/api/_lib/auth/jwt.ts` (lines 3–9)
- Current mitigation: Warning is logged to console. Vercel production throws an error if `JWT_SECRET` is missing.
- Recommendations: Treat missing `JWT_SECRET` as a startup error in all environments, not just `VERCEL=1`. Document required environment variables in a `.env.example` file.

**OTP Code Logged to Console in Non-Production Non-Vercel Environments:**
- Risk: When `RESEND_API_KEY` is not set and the server is not in a `VERCEL` production environment, OTP codes are logged in plaintext to the console (`console.log(\`[OTP] Code for ${email}: ${code}\``)).
- Files: `apps/web/api/_lib/auth/email.ts` (lines 19–22)
- Current mitigation: The condition checks both `NODE_ENV !== 'production'` and `!process.env.VERCEL`, so it should not fire on Vercel. However, staging or CI environments may not set `VERCEL=1`, causing codes to appear in logs.
- Recommendations: Remove OTP plaintext logging entirely. Use a development-mode email preview tool or require that `RESEND_API_KEY` is set in all authenticated environments. If dev logging is kept, use a clearly labelled dev-only guard.

**GitHub Token Stored in Database as Plaintext:**
- Risk: The GitHub token (`githubToken` setting) is stored in the `settings` table in plaintext. It is only masked when returned via the API (`SENSITIVE_KEYS` in `api/settings/index.ts`), but the raw value is stored and retrieved without encryption.
- Files: `apps/web/api/settings/index.ts`, `apps/web/api/_lib/config-resolver.ts`, `apps/web/api/_lib/db/client.ts`
- Current mitigation: Database access requires Turso credentials; the value is masked on GET responses.
- Recommendations: Consider encrypting sensitive values at rest using a server-side encryption key before storing in the database, or use a dedicated secrets manager.

**Cron Endpoint Uses Bearer Token Comparison With Potential Length Leak:**
- Risk: `api/cron/sync.ts` uses `crypto.timingSafeEqual` for CRON_SECRET verification but constructs the expected string as a template literal before the comparison. If `authHeader` is shorter or longer than expected but the same byte length via padding, the comparison still runs correctly. However, if `cronSecret` is empty or undefined (`!cronSecret` check at line 22 runs before the equal check), an empty `cronSecret` would cause the `Buffer.from('Bearer ')` to equal `Buffer.from('')`, and the length check would fail correctly. This is handled.
- Files: `apps/web/api/cron/sync.ts` (lines 16–23)
- Current mitigation: `!cronSecret` early return prevents empty-secret bypass. Timing-safe comparison used.
- Recommendations: No immediate action needed, but add integration tests for cron endpoint authentication boundary cases.

**Auth Token Transmitted via Query Parameter:**
- Risk: `middleware.ts` accepts the JWT via `req.query.token` as a fallback when no `Authorization` header is present. Query parameters are logged by most web servers, proxies, and CDNs, which could expose tokens in server logs.
- Files: `apps/web/api/_lib/auth/middleware.ts` (lines 13–14)
- Current mitigation: Bearer header is preferred. Query fallback exists for convenience.
- Recommendations: Remove the query parameter fallback. All clients use the `Authorization` header via `api-client.ts`.

## Performance Bottlenecks

**Event Polling at 3-Second Intervals — Every Tab:**
- Problem: `useEventPolling` polls `GET /api/events/poll` every 3 seconds per browser tab. Each poll is an authenticated request to a serverless function that queries the `events` table. With multiple users and multiple tabs, this generates `3 * tabs * users` requests per minute against the Turso database.
- Files: `apps/web/src/client/hooks/useEventPolling.ts`, `apps/web/api/events/poll.ts`
- Cause: No SSE, WebSocket, or connection-sharing mechanism. Each component mounting `useSyncEvents` creates an independent polling loop.
- Improvement path: Consolidate polling to a single shared service worker or BroadcastChannel, implement Server-Sent Events with Vercel's streaming support, or reduce polling interval when the tab is not focused using the Page Visibility API.

**GitHub Project Sync Always Fetches All Items (No Incremental Cursor):**
- Problem: `syncGitHubProject()` always starts cursor from `null` on every sync, fetching all project items via pagination regardless of whether anything has changed. `lastSyncedAt` and `cursor` are stored in `sync_state` but the cursor is never used to resume.
- Files: `apps/web/api/_lib/sync/github-sync.ts` (lines 183–185)
- Cause: Comment reads `// Always start from the beginning to catch updates`. This approach is intentional but inefficient.
- Improvement path: Use GraphQL subscription or the stored `cursor` to fetch only changed items, or filter by `updatedAt` if the GitHub Projects v2 API supports it.

**`retryPendingWritebacks` Fetches Product Info Per Task:**
- Problem: In `syncProjectBoardColumn()`, every task retry calls `getProductById(task.productId)`, then `getProjectFieldInfo(owner, projectNumber)` — a separate GitHub GraphQL request per task. If multiple tasks belong to the same product, the product and project field info are fetched redundantly for each task.
- Files: `apps/web/api/_lib/sync/github-writeback.ts` (lines 83–153)
- Cause: No caching or batching of product/project metadata during a writeback pass.
- Improvement path: Group pending tasks by `productId` before processing, and cache `getProjectFieldInfo` results per `(owner, projectNumber)` within a single cron run.

## Fragile Areas

**In-Memory Database Migration Guard in Serverless Context:**
- Files: `apps/web/api/_lib/db/client.ts` (lines 4–25)
- Why fragile: Module-level `client` and `migrated` variables behave differently in serverless cold starts versus warm re-use. The actual correctness depends on Turso's `IF NOT EXISTS` SQL, not the in-memory flag. Any change to module loading order or bundler behaviour could cause unexpected double-execution.
- Safe modification: Do not remove the `IF NOT EXISTS` guards in SQL. Always test migration changes against a real Turso instance, not just the in-memory flag.
- Test coverage: No tests for the migration path exist.

**`mapToDisplayStatus` Silently Hides Task Statuses:**
- Files: `apps/web/src/client/components/KanbanBoard.tsx` (lines 314–327)
- Why fragile: `queue` maps to `backlog`, `ai_review` maps to `human_review`, `error` maps to `human_review`, and `pr_created` maps to `done`. These statuses have internal meaning in the task model, but users see them merged into other columns. Adding a new internal status without updating `mapToDisplayStatus` causes it to fall through to `default: return status`, which would show a column not in the `COLUMNS` array, resulting in tasks that appear in an unlabelled column.
- Safe modification: Whenever a new `TaskStatus` value is added to the type, `mapToDisplayStatus` must be explicitly updated. Add a TypeScript exhaustiveness check (`const _: never = status` at the end of the switch) to catch missing cases at compile time.
- Test coverage: No tests for `mapToDisplayStatus`.

**OTP Rate Limit Check Is Not Atomic:**
- Files: `apps/web/api/_lib/auth/otp.ts` (lines 26–33)
- Why fragile: The cleanup of expired OTPs, the count query, and the insert are three separate database statements with no transaction wrapping them. Under concurrent requests for the same email, two simultaneous `storeOtp` calls could both pass the `recentCount >= OTP_RATE_LIMIT` check (both read 4 rows) and both insert, resulting in 6 OTPs when the limit is 5.
- Safe modification: Wrap the three operations in a transaction, or use a database-level trigger/constraint for rate limiting.
- Test coverage: No tests for OTP race conditions.

## Scaling Limits

**Single Turso Database (No Sharding):**
- Current capacity: All products, tasks, events, settings, and users share one Turso database file.
- Limit: Turso has row limits and connection limits per plan. The events table grows with every user action and is only purged hourly by the cron job. At high activity, the events table could accumulate tens of thousands of rows between purge cycles.
- Scaling path: Run event purge more frequently, partition events by product, or move to a dedicated event streaming service.

**Cron Job Runs Every Minute (Vercel Free Plan Limit Risk):**
- Current capacity: `vercel.json` schedules `GET /api/cron/sync` at `* * * * *` (every minute). On Vercel Hobby, cron jobs are limited to once per day; on Pro, they allow per-minute scheduling.
- Limit: If deployed on a plan that does not support per-minute crons, the sync will silently not run.
- Scaling path: Document the required Vercel plan in the README. Add monitoring for cron execution to detect silent failures.

## Dependencies at Risk

**Custom JWT Implementation (No Battle-Tested Library):**
- Risk: `api/_lib/auth/jwt.ts` implements JWT creation and verification from scratch using Node.js `crypto`. While the implementation appears correct (timing-safe comparison, expiry check), it lacks features of established libraries: no support for key rotation, no standard claim validation (`iss`, `aud`, `nbf`), no algorithm agility.
- Impact: Any bug in the custom crypto code directly affects all authentication. Updating the algorithm requires manual migration.
- Migration plan: Replace with `jose` (pure ESM, edge-compatible) or `jsonwebtoken` for full JWT standard compliance and easier key rotation.

**`@libsql/client` Listed in `dependencies` (Not Dev-Only):**
- Risk: `@libsql/client` (the Turso SQLite client) is a production dependency in `package.json`. It is used only in server-side API routes, but the package is bundled into the client build unless Vite excludes it.
- Files: `apps/web/package.json` (line 25)
- Impact: May increase client bundle size if not properly tree-shaken or externalized by Vite.
- Migration plan: Move `@libsql/client` to a server-only code path and verify it is excluded from the Vite client bundle with `npm run build`.

## Missing Critical Features

**No Error Monitoring or Structured Logging:**
- Problem: All error reporting uses `console.log`/`console.error`. There is no integration with error tracking (Sentry, Datadog, etc.) or structured logging. Errors in GitHub sync, write-back retries, and cron jobs are swallowed or logged to the console, which is not inspectable in production serverless environments.
- Blocks: Diagnosing sync failures, tracking auth errors, or understanding production issue frequency requires manually reading Vercel function logs.

**No Email Configuration for Non-Resend Environments:**
- Problem: If `RESEND_API_KEY` is not set in production (`process.env.VERCEL` is truthy), `sendOtpEmail` falls through to `console.log` with a message saying the code was sent but not providing the actual code. Users cannot log in.
- Files: `apps/web/api/_lib/auth/email.ts` (lines 18–25)
- Blocks: Authentication completely fails silently if `RESEND_API_KEY` is missing in production.

## Test Coverage Gaps

**No Tests for Any API Endpoint:**
- What's not tested: All `api/` route handlers (`tasks`, `products`, `auth`, `settings`, `cron`, `events`) have zero automated test coverage.
- Files: All files under `apps/web/api/`
- Risk: Authentication middleware bypasses, role enforcement bugs, concurrency issues in OTP, and GitHub sync edge cases cannot be caught before deployment.
- Priority: High

**No Tests for Sync Logic:**
- What's not tested: `github-sync.ts`, `github-writeback.ts` — the core sync pipeline that connects the app to GitHub.
- Files: `apps/web/api/_lib/sync/github-sync.ts`, `apps/web/api/_lib/sync/github-writeback.ts`
- Risk: Silent failures in write-back retry, incorrect status mapping, pagination bugs in project item sync.
- Priority: High

**No Tests for Frontend State Stores:**
- What's not tested: `task-store.ts`, `auth-store.ts`, `settings-store.ts`, `product-store.ts`
- Files: `apps/web/src/client/stores/`
- Risk: Optimistic concurrency logic in `updateTask` and `updateTaskStatus`, session expiry handling in `checkSession`, store rehydration from localStorage.
- Priority: Medium

**No Tests for Validation Schemas:**
- What's not tested: `validation.ts` Zod schemas — the boundary between untrusted input and internal data.
- Files: `apps/web/api/_lib/validation.ts`
- Risk: Edge cases in `githubRepo` regex, label/assignee max-count limits, and status enum values could be silently wrong.
- Priority: Medium

---

*Concerns audit: 2026-04-21*
