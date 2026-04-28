# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- Vitest 4
- Config: `apps/desktop/vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (globals enabled)
- `@testing-library/jest-dom` for DOM assertions (imported per-file with `import '@testing-library/jest-dom/vitest'`)

**E2E Framework:**
- Playwright with Electron support
- Config: `apps/desktop/e2e/playwright.config.ts`

**Run Commands:**
```bash
cd apps/desktop && npm test                   # Run all unit tests (vitest run)
cd apps/desktop && npm run test:unit          # Unit tests only (excludes integration/ and e2e/)
cd apps/desktop && npm run test:integration   # Integration tests only
cd apps/desktop && npm run test:watch         # Watch mode
cd apps/desktop && npm run test:coverage      # Run with coverage report
cd apps/desktop && npm run test:e2e           # Playwright E2E tests
```

## Test File Organization

**Location:**
- Unit tests are co-located with source in `__tests__/` subdirectories within feature directories, OR directly alongside source files with `.test.ts` / `.test.tsx` suffix
- Integration tests: `src/__tests__/integration/`
- E2E tests (Vitest smoke): `src/__tests__/e2e/`
- E2E tests (Playwright): `apps/desktop/e2e/*.e2e.ts`
- Global mocks: `src/__mocks__/`
- Global test setup: `src/__tests__/setup.ts`

**Naming:**
- Unit: `ComponentName.test.tsx` or `module-name.test.ts`
- Integration: descriptive names in `src/__tests__/integration/` (e.g., `task-lifecycle.test.ts`)
- Playwright E2E: `*.e2e.ts` (matched by Playwright config `testMatch: '**/*.e2e.ts'`)

**Structure:**
```
src/
├── __mocks__/
│   ├── electron.ts                          # Full Electron API mock
│   ├── sentry-electron-main.ts
│   ├── sentry-electron-renderer.ts
│   └── sentry-electron-shared.ts
├── __tests__/
│   ├── setup.ts                             # Global beforeEach/afterEach, window.electronAPI mock
│   ├── integration/
│   │   ├── task-lifecycle.test.ts
│   │   ├── claude-profile-ipc.test.ts
│   │   └── ...
│   └── e2e/
│       └── smoke.test.ts
├── renderer/
│   ├── components/
│   │   ├── settings/
│   │   │   ├── ProfileList.tsx
│   │   │   ├── ProfileList.test.tsx         # Co-located test
│   │   │   └── __tests__/
│   │   │       └── DisplaySettings.test.tsx
│   │   └── __tests__/
│   │       └── AgentTools.test.tsx
│   └── stores/
│       └── __tests__/
│           ├── task-store-persistence.test.ts
│           └── terminal-store.callbacks.test.ts
└── main/
    └── ai/
        └── tools/
            └── providers/
                └── __tests__/
                    ├── tavily-search.test.ts
                    └── serper-search.test.ts
e2e/
├── playwright.config.ts
├── task-workflow.spec.ts
├── flows.e2e.ts
└── claude-accounts.e2e.ts
```

## Test Structure

**Suite Organization:**
```typescript
/**
 * @vitest-environment jsdom   ← Required for DOM tests
 */
/**
 * Unit tests for ProfileList
 * Tests utility functions and verifies component structure
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // Required when using vi.doMock for fresh module state
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature Group', () => {
    it('should describe behavior clearly', () => {
      // Arrange
      // Act
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

**vitest-environment directive:**
- `@vitest-environment jsdom` required for renderer/component tests (Radix UI, DOM APIs)
- Default environment is `node` (set in `vitest.config.ts`) — only specify jsdom when needed

**Patterns:**
- `beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); })` — standard setup in store tests to ensure fresh module state
- `afterEach(() => { vi.restoreAllMocks(); })` — restore spies after each test
- Test data directory `/tmp/auto-claude-ui-tests` used for file-based integration tests (created/cleaned in global setup)

## Mocking

**Framework:** Vitest `vi` module

**Module-level mocks (static):**
```typescript
// Declared before imports, hoisted automatically
vi.mock('../../stores/settings-store', () => ({
  useSettingsStore: vi.fn()
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key
  }))
}));
```

**Hoisted mock factories:**
For mocks that need to be created before module loading:
```typescript
const mockGenerateIdeation = vi.hoisted(() => vi.fn());

vi.mock('../../../../stores/ideation-store', () => ({
  generateIdeation: mockGenerateIdeation,
  // ...
}));
```

**Dynamic mocks (for fresh module state):**
Used when a test needs to `resetModules()` and re-import:
```typescript
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  vi.doMock('../../../shared/utils/debug-logger', () => ({
    debugLog: vi.fn(),
    debugError: vi.fn(),
  }));

  // Fresh import after doMock
  const storeModule = await import('../task-store');
  useTaskStore = storeModule.useTaskStore;
});
```

**Stubbing globals:**
```typescript
vi.stubGlobal('window', {
  electronAPI: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    // ...
  }
});

vi.stubEnv('TAVILY_API_KEY', 'test-key-123');
```

**What to Mock:**
- All Electron APIs (via `src/__mocks__/electron.ts` alias in vitest config)
- `window.electronAPI` — the IPC bridge to main process
- `react-i18next` `useTranslation` — return `t: (key) => key` or provide translation map
- Zustand stores — mock the whole module with `vi.mock()`
- External SDKs (Tavily, Serper, etc.) — mock at module level
- Sentry (`@sentry/electron/main`, `@sentry/electron/renderer`) — via `src/__mocks__/` aliases
- `useToast` / `toast` hook — mock to capture calls
- File system in unit tests — mock `fs` or use `/tmp` test directories

**What NOT to Mock:**
- Pure utility functions being tested (test them directly)
- Type definitions
- Constants and enums
- `cn()` and other pure CSS utilities

## Global Test Setup (`src/__tests__/setup.ts`)

The global setup file runs before every test:
- Mocks `localStorage` with `vi.fn()` implementations
- Mocks `scrollIntoView`, `requestAnimationFrame`, `cancelAnimationFrame` for jsdom
- Mocks `window.electronAPI` with `vi.fn()` stubs for all IPC methods
- Suppresses `console.error` (except messages containing `[TEST]`)
- Creates and cleans `/tmp/auto-claude-ui-tests` directory per test run
- `vi.clearAllMocks()` in `beforeEach`; `vi.resetModules()` in `afterEach`

## Fixtures and Factories

**Test Data — Factory Function Pattern:**
Factory functions are the preferred pattern for creating test data. All test files use this approach consistently:
```typescript
function createTestFeature(overrides: Partial<RoadmapFeature> = {}): RoadmapFeature {
  return {
    id: `feature-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    title: 'Test Feature',
    description: 'Test description',
    priority: 'should' as RoadmapFeaturePriority,
    // ... all required fields with sensible defaults
    ...overrides,  // Caller can override any field
  };
}

// Usage
const feature = createTestFeature({ priority: 'must', status: 'accepted' });
```

**Store Mock Factory:**
```typescript
function createSettingsStoreMock(overrides: Partial<ReturnType<typeof useSettingsStore>> = {}) {
  const mockDeleteProfile = vi.fn().mockResolvedValue(true);
  return {
    profiles: testProfiles,
    activeProfileId: 'profile-1' as string | null,
    deleteProfile: mockDeleteProfile,
    ...overrides,
  };
}
```

**Location:**
- Factory functions are defined inline within each test file (no shared fixture files)
- Static test data (e.g., `testProfiles`) defined as `const` arrays at the top of the test file

## Coverage

**Requirements:**
- Lines: 22% minimum
- Branches: 17% minimum
- Functions: 19% minimum
- Statements: 22% minimum
- Thresholds configured in `apps/desktop/vitest.config.ts`
- Coverage provider: V8

**View Coverage:**
```bash
cd apps/desktop && npm run test:coverage
# Reports: text (terminal), json, html, json-summary
# Output directory: coverage/ (default vitest location)
```

## Test Types

**Unit Tests (207 total test files):**
- Scope: Individual functions, hooks, components, store actions, utility modules
- Location: Co-located `__tests__/` directories or `*.test.ts` alongside source
- All Electron/IPC dependencies mocked

**Integration Tests (`src/__tests__/integration/`):**
- Scope: IPC communication flows, file system interactions, task lifecycle, terminal operations
- Files: `task-lifecycle.test.ts`, `claude-profile-ipc.test.ts`, `ipc-bridge.test.ts`, `file-watcher.test.ts`, `terminal-copy-paste.test.ts`, `rate-limit-subtask-recovery.test.ts`, `subprocess-spawn.test.ts`
- Run: `npm run test:integration`

**E2E Tests (Playwright, `e2e/`):**
- Scope: Full Electron app interaction via Chrome DevTools Protocol
- Files: `*.e2e.ts` (e.g., `flows.e2e.ts`, `task-workflow.spec.ts`, `claude-accounts.e2e.ts`)
- Requires: Built app (`npm run build`) before running
- Run: `npm run test:e2e`
- Config: `e2e/playwright.config.ts` (single worker, serial execution, 60s timeout)

**Component Tests:**
- Use `@testing-library/react` `render`, `screen`, `fireEvent`
- Wrap components in provider wrappers when needed (e.g., `TooltipProvider`)
- Use custom `renderWithWrapper` helper pattern:
  ```typescript
  function TestWrapper({ children }: { children: React.ReactNode }) {
    return <TooltipProvider>{children}</TooltipProvider>;
  }
  function renderWithWrapper(ui: React.ReactElement) {
    return render(ui, { wrapper: TestWrapper });
  }
  ```

**Hook Tests:**
- Use `renderHook` and `act` from `@testing-library/react`
- Wrap with provider when hook requires context:
  ```typescript
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ViewStateProvider>{children}</ViewStateProvider>
  );
  const { result } = renderHook(() => useViewState(), { wrapper });
  ```

## Common Patterns

**Async Testing:**
```typescript
it('should load tasks from IPC', async () => {
  mockGetTasks.mockResolvedValue({ success: true, data: mockTasks });
  await loadTasks('test-project');
  const state = useTaskStore.getState();
  expect(state.tasks).toHaveLength(1);
});
```

**Error Testing:**
```typescript
it('should throw when API key is missing', async () => {
  vi.stubEnv('TAVILY_API_KEY', '');
  const provider = new TavilySearchProvider();
  await expect(provider.search('test')).rejects.toThrow('TAVILY_API_KEY');
});
```

**Zustand Store Reset Between Tests:**
```typescript
beforeEach(() => {
  useRoadmapStore.setState({
    roadmap: null,
    generationStatus: { phase: 'idle' },
    // ... reset to initial state
  });
});
```

**Radix UI Components in jsdom:**
Radix UI's portals and Select don't work in jsdom. Mock the UI module:
```typescript
vi.mock('../../ui/select', () => ({
  Select: ({ value, onValueChange, children }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }) => <button>{children}</button>,
  // ...
}));
```

**IPC Result Assertions:**
```typescript
it('should handle successful IPC response', async () => {
  mockGetTasks.mockResolvedValue({ success: true, data: mockTasks });
  const result = await loadTasks('project-id');
  expect(mockGetTasks).toHaveBeenCalledWith('project-id');
});
```

**Spy on console.error (suppress expected errors):**
```typescript
it('should throw error when used outside provider', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => renderHook(() => useViewState())).toThrow('must be used within');
  consoleSpy.mockRestore();
});
```

## Electron Module Alias

In `vitest.config.ts`, the `electron` module is aliased to the mock:
```typescript
alias: {
  electron: resolve(__dirname, 'src/__mocks__/electron.ts'),
  '@sentry/electron/main': resolve(__dirname, 'src/__mocks__/sentry-electron-main.ts'),
  '@sentry/electron/renderer': resolve(__dirname, 'src/__mocks__/sentry-electron-renderer.ts')
}
```

This means any `import { app, ipcMain } from 'electron'` in tested code automatically resolves to the mock — no per-test `vi.mock('electron')` required unless the test needs a specific ipcMain behavior.

---

*Testing analysis: 2026-04-21*
