# External Integrations

**Analysis Date:** 2026-04-21

## APIs & External Services

**AI Providers (via Vercel AI SDK — desktop app):**
All providers are accessed through `apps/desktop/src/main/ai/providers/factory.ts` using `createProvider()`. Never use `@anthropic-ai/sdk` directly for agent calls.

- Anthropic Claude — Primary AI provider; supports OAuth tokens (`sk-ant-oa*`) and API keys (`sk-ant-api*`)
  - SDK: `@ai-sdk/anthropic`
  - Auth: OAuth access token or API key configured per-profile in OS credential store
  - Special: `anthropic-beta: claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14` header for OAuth

- OpenAI / Codex — General + Codex model support; Codex uses Responses API not Chat Completions
  - SDK: `@ai-sdk/openai`
  - Auth: API key or OAuth token file path (`oauthTokenFilePath`)

- Google Gemini — Alternative provider
  - SDK: `@ai-sdk/google`
  - Auth: API key

- AWS Bedrock — Enterprise provider
  - SDK: `@ai-sdk/amazon-bedrock`
  - Auth: AWS credentials + region (default `us-east-1`)

- Azure OpenAI — Enterprise provider with deployment-based routing
  - SDK: `@ai-sdk/azure`
  - Auth: API key + deployment name

- Mistral AI — Alternative provider
  - SDK: `@ai-sdk/mistral`
  - Auth: API key

- Groq — High-speed inference provider
  - SDK: `@ai-sdk/groq`
  - Auth: API key

- xAI Grok — Alternative provider
  - SDK: `@ai-sdk/xai`
  - Auth: API key

- OpenRouter — Aggregator provider
  - SDK: `@openrouter/ai-sdk-provider`
  - Auth: API key

- Z.AI — GLM model provider (OpenAI-compatible)
  - SDK: `@ai-sdk/openai-compatible`
  - Base URL: `https://api.z.ai/api/paas/v4`
  - Auth: API key

- Ollama — Local model provider (self-hosted)
  - SDK: `@ai-sdk/openai-compatible`
  - Base URL: `http://localhost:11434/v1` (configurable)
  - Auth: Not required (local)

**Web Search (desktop app):**
- Serper.dev — Google search results API
  - Client: `apps/desktop/src/main/ai/tools/providers/serper-search.ts`
  - Auth: `SERPER_API_KEY` (embedded at build time via `__SERPER_API_KEY__`)
  - Free tier: 2,500 queries on signup

- Tavily — AI-native web search API
  - Client: `apps/desktop/src/main/ai/tools/providers/tavily-search.ts`
  - SDK: `@tavily/core`
  - Auth: API key (user-configured)

**Email (web app):**
- Resend — Transactional email for OTP authentication
  - SDK: `resend` ^6.10.0
  - Client: `apps/web/api/_lib/auth/email.ts`
  - Auth: `RESEND_API_KEY` env var
  - From address: `OTP_FROM_EMAIL` env var (default: `onboarding@resend.dev`)

**Error Tracking:**
- Sentry — Error and performance monitoring
  - SDK: `@sentry/electron` ^7.10.0 (covers both main and renderer process)
  - Client (main): `apps/desktop/src/main/sentry.ts`
  - Auth: `SENTRY_DSN` (embedded at build time; if absent, Sentry is disabled)
  - Sample rates: `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE` (default 10% in prod)
  - Privacy: usernames masked from all file paths before sending

## Data Storage

**Databases:**

- libSQL / Turso — Primary storage for desktop memory system and web SaaS
  - SDK: `@libsql/client` ^0.17.0
  - Desktop local mode: file-based libSQL at `<userData>/memory.db` (`apps/desktop/src/main/ai/memory/db.ts`)
  - Desktop cloud mode: embedded replica syncing to Turso Cloud (60s interval)
  - Web mode: pure cloud libSQL at `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (`apps/web/api/_lib/db/client.ts`)
  - Schema: `apps/desktop/src/main/ai/memory/schema.ts` (WAL mode, foreign keys enabled)
  - Graph schema: `apps/desktop/src/main/ai/memory/graph/graph-database.ts` (nodes, edges, closure table)
  - Note: Loaded lazily via CJS `require()` in Electron due to native module resolution constraints

**File Storage:**
- Local filesystem only — Project data, spec files, git worktrees all stored locally
- Spec directory: `.auto-claude/specs/XXX-name/` (per project, gitignored)

**Caching:**
- In-memory embedding cache backed by libSQL `embedding_cache` table (7-day TTL)
- In-memory credential cache in `apps/desktop/src/main/claude-profile/credential-utils.ts`

## Authentication & Identity

**AI Account Auth (desktop):**
- Anthropic OAuth — Claude subscription auth via OAuth 2.0 device flow
  - Token storage: OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
  - Token refresh: `apps/desktop/src/main/claude-profile/token-refresh.ts`
  - Multi-profile: up to N accounts registered; auto-switches on rate limit
  - Profile scoring: `apps/desktop/src/main/claude-profile/profile-scorer.ts`
  - Token encryption at rest: `apps/desktop/src/main/claude-profile/token-encryption.ts`

**GitHub Auth (desktop):**
- GitHub CLI (`gh`) device flow — OAuth via GitHub CLI installed on host system
  - Handler: `apps/desktop/src/main/ipc-handlers/github/oauth-handlers.ts`
  - Requires `gh` CLI to be installed (resolved via `getToolPath('gh')`)
  - Sends device code to renderer via IPC for display

**GitLab Auth (desktop):**
- Personal Access Token — user-provided token stored in project `.env`
  - Handler: `apps/desktop/src/main/ipc-handlers/gitlab/oauth-handlers.ts`

**Linear Auth (desktop):**
- API Key — user-provided key stored in project `.env` as `LINEAR_API_KEY`
  - Handler: `apps/desktop/src/main/ipc-handlers/linear-handlers.ts`

**Web App Auth:**
- OTP email auth — stateless JWT tokens after email OTP verification
  - JWT: custom HMAC-SHA256 implementation in `apps/web/api/_lib/auth/jwt.ts`
  - Secret: `JWT_SECRET` env var (required in production)
  - OTP: generated, hashed, stored in libSQL, verified within 5-minute window
  - Email delivery: Resend (see Email section above)
  - Rate limiting: enforced per email address

## Monitoring & Observability

**Error Tracking:**
- Sentry (see Error Tracking above)

**Logs:**
- electron-log 5.x — Persistent file logging to `<userData>/logs/` on all platforms
  - Config: `apps/desktop/src/main/app-logger.ts`
  - Log rotation via electron-log's built-in archive function
  - Fallback: stderr when electron-log itself throws (e.g., I/O errors)

**Usage Monitoring:**
- Custom usage monitor for AI API consumption per profile
  - `apps/desktop/src/main/claude-profile/usage-monitor.ts`
  - Tracks token usage for rate limit detection

## CI/CD & Deployment

**Hosting:**
- Desktop: Self-distributed; electron-builder packages to GitHub Releases
  - macOS: `.dmg` + `.zip`
  - Windows: NSIS installer + `.zip`
  - Linux: AppImage + `.deb` + Flatpak
  - GitHub Release publisher: `owner: AndyMik90, repo: Aperant`

- Web app: Vercel (configured in `apps/web/vercel.json`)
  - Framework: Vite
  - API routes: Vercel serverless functions under `apps/web/api/`
  - Cron: `/api/cron/sync` runs every minute (data sync)

**Auto-Updates:**
- electron-updater 6.x pulls from GitHub Releases
  - Update check: `apps/desktop/src/main/app-updater.ts`
  - Channels: stable and beta (`allowPrerelease` flag)
  - Manual version rollback supported

## MCP (Model Context Protocol)

**MCP Client:**
- Protocol SDK: `@modelcontextprotocol/sdk` ^1.27.1
- AI SDK integration: `@ai-sdk/mcp` ^1.0.25
- Client factory: `apps/desktop/src/main/ai/mcp/client.ts`
- Supports: stdio transport and StreamableHTTP/SSE transport
- Primary use: Graphiti memory sidecar (Python process, optional)
- Electron MCP: enables QA agents to control the Electron app via Chrome DevTools Protocol on port 9222 (debug/MCP mode)

## Version Control Integrations

**GitHub (desktop):**
- REST API + GraphQL via `gh` CLI and direct `fetch` calls
  - Import issues: `apps/desktop/src/main/ipc-handlers/github/import-handlers.ts`
  - PR creation/review: `apps/desktop/src/main/ipc-handlers/github/pr-handlers.ts`
  - Issue triage/investigation: `apps/desktop/src/main/ipc-handlers/github/triage-handlers.ts`
  - OAuth: device flow via `gh auth login --web`

**GitLab (desktop):**
- REST API via direct `fetch` calls
  - Import issues: `apps/desktop/src/main/ipc-handlers/gitlab/import-handlers.ts`
  - MR creation/review: `apps/desktop/src/main/ipc-handlers/gitlab/mr-review-handlers.ts`
  - Auth: PAT stored in project `.env`

**Linear (desktop):**
- GraphQL API at `https://api.linear.app/graphql`
  - Handler: `apps/desktop/src/main/ipc-handlers/linear-handlers.ts`
  - Auth: `LINEAR_API_KEY` from project `.env`
  - Features: import issues, create specs, sync status

**Web App GitHub:**
- GitHub REST API for repository operations
  - Client: `apps/web/api/_lib/github.ts`
  - Auth: `GITHUB_TOKEN` env var (server-side only)

## Webhooks & Callbacks

**Incoming:**
- None — desktop app has no HTTP server; all integrations are outbound polling

**Outgoing:**
- GitHub API calls (REST + via `gh` CLI)
- GitLab API calls (REST)
- Linear GraphQL API calls
- AI provider API calls (all providers listed above)

## Environment Configuration

**Desktop required env vars (runtime):**
- `SENTRY_DSN` — Error reporting (optional; disables Sentry if absent)
- `SERPER_API_KEY` — Web search (embedded at build time from CI secrets)

**Web app required env vars:**
- `TURSO_DATABASE_URL` — Turso/libSQL database URL
- `TURSO_AUTH_TOKEN` — Turso authentication token
- `JWT_SECRET` — Token signing secret (required in production)
- `RESEND_API_KEY` — Resend email API key
- `GITHUB_TOKEN` — GitHub API access for repository operations
- `OTP_FROM_EMAIL` — Sender email address (optional; defaults to `onboarding@resend.dev`)

**Secrets location:**
- Desktop: OS keychain for AI credentials; CI secrets for build-time embedded keys
- Web: Vercel environment variables (project settings)

---

*Integration audit: 2026-04-21*
