# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Kebab-case for all TypeScript/TSX files: `task-store.ts`, `debug-logger.ts`, `changelog-handlers.ts`
- Test files follow source file name with `.test.ts` / `.test.tsx` suffix: `ProfileList.test.tsx`, `task-store-persistence.test.ts`
- Barrel files named `index.ts` for module re-exports
- Store files named `*-store.ts`: `task-store.ts`, `settings-store.ts`, `kanban-settings-store.ts`
- Hook files prefixed with `use`: `useIdeation.ts`, `useGitHubPRs.ts`, `useXterm.ts`
- IPC handler files named `*-handlers.ts` or `*-ipc.ts`: `changelog-handlers.ts`, `insights-handlers.ts`

**Functions:**
- camelCase for all functions and methods: `loadTasks()`, `generateChangelog()`, `registerOutputCallback()`
- React components use PascalCase: `ProfileList`, `AuthStatusIndicator`, `ViewStateProvider`
- Factory functions prefixed with `create`: `createTestFeature()`, `createTestPhase()`, `createProviderRegistry()`
- Event handler functions prefixed with `handle`: `handleGenerate()`, `handleRefresh()`
- Boolean state setters prefixed with `set`: `setTasks()`, `setLoading()`, `setError()`
- Boolean state toggles prefixed with `toggle`: `toggleSelectIdea()`, `toggleShowArchived()`
- Register/setup functions prefixed with `register` or `setup`: `registerChangelogHandlers()`, `setupIdeationListeners()`
- Cleanup functions named `cleanup`, `cleanupListeners`, or return a cleanup function

**Variables:**
- camelCase for all variables and constants: `taskLastActivity`, `MAX_LOG_ENTRIES`, `DEFAULT_MAX_PARALLEL_TASKS`
- SCREAMING_SNAKE_CASE for module-level true constants: `MAX_AUTH_RETRIES`, `STUCK_ACTIVITY_THRESHOLD_MS`, `DEFAULT_LINE_LIMIT`
- Private class fields use conventional naming (no `#` prefix observed), with underscore prefix for intentionally unused parameters: `_paths`, `_projectId`

**Types/Interfaces:**
- PascalCase for all types and interfaces: `IPCResult<T>`, `TaskState`, `SessionConfig`
- Interface names do NOT use `I` prefix: `TaskState` not `ITaskState`
- Generic type parameters use single uppercase letters or descriptive names: `T`, `TData`
- Zustand store interfaces use `*State` suffix: `TaskState`, `KanbanSettingsState`, `MRReviewStoreState`

## Code Style

**Formatting:**
- Tool: Prettier (formatter is disabled in Biome — they use Biome for linting only)
- Tab-based indentation (observed in source files)
- Single quotes for strings in TypeScript/TSX

**Linting:**
- Tool: Biome 2 (`biome.jsonc` at `apps/desktop/biome.jsonc`)
- `noExplicitAny` is a **warning** (not error) — avoid `any` but allowed with `// eslint-disable-next-line` or biome-ignore comments
- `noUnusedVariables` and `noUnusedFunctionParameters` are **warnings**
- `noEmptyBlockStatements` is a **warning**
- `noDangerouslySetInnerHtml` is a **warning** (legitimate uses exist for sanitized markdown)
- `noConsole` is **off** — but production code should use `debugLog`/Sentry, not raw `console.log`
- `useArrowFunction` is **off** — both regular functions and arrow functions are acceptable
- `noDefaultExport` is **off** — both named and default exports are acceptable
- Run: `cd apps/desktop && npm run lint` / `npm run lint:fix`

**TypeScript:**
- Strict mode enabled in `tsconfig.json` (`"strict": true`)
- Target: ES2022, moduleResolution: bundler
- `noEmit: true` (build is handled by electron-vite)
- Inline type imports preferred: `import type { Task } from '../../shared/types'`
- Type assertions using `as` with documented reason when needed

## Import Organization

**Order (observed pattern):**
1. Node built-ins (e.g., `import path from 'path'`, `import { EventEmitter } from 'events'`)
2. Third-party packages (e.g., `import { create } from 'zustand'`, `import { streamText } from 'ai'`)
3. Internal path aliases (`@/*`, `@shared/*`, `@preload/*`)
4. Relative imports (closest first)

**Path Aliases (from `tsconfig.json`):**
- `@/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@preload/*` → `src/preload/*`
- `@features/*` → `src/renderer/features/*`
- `@components/*` → `src/renderer/shared/components/*`
- `@hooks/*` → `src/renderer/shared/hooks/*`
- `@lib/*` → `src/renderer/shared/lib/*`

**Type-only imports:**
- Use `import type { ... }` for types that are not used at runtime:
  ```typescript
  import type { Task, TaskStatus } from '../../shared/types';
  ```

## Error Handling

**IPC Handler Pattern (Main Process):**
All IPC handlers return `IPCResult<T>` (defined in `src/shared/types/common.ts`):
```typescript
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Handlers always wrap operations in try/catch and return structured results:
```typescript
ipcMain.handle(IPC_CHANNELS.SOME_CHANNEL, async (_, args): Promise<IPCResult<Data>> => {
  const project = projectStore.getProject(args.projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  try {
    const result = await someOperation(project.path);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform operation'
    };
  }
});
```

**Error type narrowing:**
Always narrow `unknown` errors with `instanceof Error` check:
```typescript
error instanceof Error ? error.message : 'Fallback error message'
```

**React Error Boundaries:**
`ErrorBoundary` component at `src/renderer/components/ui/ErrorBoundary.tsx` wraps sections that may fail. Uses `captureException` from Sentry for error reporting.

**Renderer Error Handling:**
- Stores expose `error: string | null` state
- Actions set error state and optionally show toast notifications
- Use `toast()` from `src/renderer/hooks/use-toast.ts` for user-facing error messages

## Logging

**Framework:** Custom `debugLog` utility + Sentry for production errors

**Debug Logger** (`src/shared/utils/debug-logger.ts`):
```typescript
import { debugLog, debugWarn, debugError } from '../../shared/utils/debug-logger';

// Only logs when DEBUG=true env var is set
debugLog('Loading tasks for project', projectId);
debugWarn('Unexpected state', state);
debugError('Operation failed', error);
```

**Rules:**
- NEVER use raw `console.log` in production code — it is invisible in bundled Electron apps
- Use `debugLog` / `debugWarn` / `debugError` for development-only diagnostic output
- Use Sentry (`captureException`) for production error tracking
- `console.warn` for Sentry init failures is acceptable (e.g., `console.warn('[Sentry] Failed to initialize')`)

**Sentry:**
- Renderer Sentry init: `src/renderer/lib/sentry.ts` → `initSentryRenderer()`
- Main process: `@sentry/electron/main`
- Import `captureException` from `src/renderer/lib/sentry` in renderer code

## Comments

**When to Comment:**
- Document all exported classes, functions, and interfaces with JSDoc
- Add section dividers (`// ============`) for long files organized into sections
- Comment non-obvious decisions or workarounds, e.g.:
  ```typescript
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally matching control chars for sanitization
  ```
- Reference issue numbers in comments: `// Related to Issue #1657: Bug - Logs disappear after restart`

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Helper to find task index by id or specId.
 * Returns -1 if not found.
 */
function findTaskIndex(tasks: Task[], taskId: string): number { ... }

/**
 * Build and return a ToolRegistry with all builtin tools registered.
 */
export function buildToolRegistry(): ToolRegistry { ... }
```

**File Headers:**
Files often begin with a block comment describing the module purpose:
```typescript
/**
 * Build Tool Registry
 * ===================
 *
 * Shared helper that creates a ToolRegistry pre-populated with all builtin tools.
 */
```

## Function Design

**Size:** Functions are generally kept small and single-purpose. Long files are divided into sections with banner comments.

**Parameters:** Prefer destructured objects for 3+ parameters. Use optional parameters with `?` suffix.

**Return Values:**
- Async functions return `Promise<T>` explicitly in IPC handlers
- Side-effect-only functions return `void`
- Functions that may fail return `IPCResult<T>` or throw (never silently swallow)

**Arrow vs Regular:** Both are used; arrow functions preferred for callbacks and inline handlers.

## Module Design

**Exports:**
- Prefer named exports for utilities, types, functions, and Zustand stores
- Default exports used for React components (Biome rule `noDefaultExport` is off)
- Barrel `index.ts` files re-export from subdirectories for clean public APIs

**Zustand Store Pattern:**
```typescript
// Define interface
interface TaskState {
  tasks: Task[];
  // ... actions mixed in
  loadTasks: (projectId: string) => Promise<void>;
}

// Create store
export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loadTasks: async (projectId) => { /* ... */ },
}));

// Export standalone functions for use outside React
export async function loadTasks(projectId: string): Promise<void> {
  return useTaskStore.getState().loadTasks(projectId);
}
```

**IPC Handler Pattern:**
Each domain has a `register*Handlers(getMainWindow)` function:
```typescript
export function registerChangelogHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(IPC_CHANNELS.SOME_CHANNEL, async (_, args) => { ... });
}
```

## i18n Conventions

All frontend user-facing text uses `react-i18next`. Never hardcode user-visible strings:
```tsx
// CORRECT
const { t } = useTranslation(['navigation', 'common']);
<span>{t('navigation:items.githubPRs')}</span>

// WRONG
<span>GitHub PRs</span>
```

Translation namespaces: `common`, `navigation`, `settings`, `dialogs`, `tasks`, `errors`, `onboarding`, `welcome`
Translation files: `src/shared/i18n/locales/en/*.json` and `src/shared/i18n/locales/fr/*.json`

## Styling Conventions

Use `cn()` helper from `src/renderer/lib/utils.ts` for conditional class merging:
```typescript
import { cn } from '../../lib/utils';

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

Tailwind CSS v4 with `@tailwindcss/postcss` plugin. Use CSS custom properties for theme values.
Variant-based component styling uses `class-variance-authority` (CVA).

---

*Convention analysis: 2026-04-21*
