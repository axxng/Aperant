import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getClient before importing tasks module
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));

import { rowToTask, buildSyncState, buildCreateTaskInput, buildUpdateTaskFields } from './tasks.js';

// Minimal valid DB row helper
function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'task-1',
    product_id: 'prod-1',
    title: 'Test Task',
    description: 'desc',
    status: 'backlog',
    review_reason: null,
    priority: null,
    category: null,
    github_issue_number: null,
    github_issue_url: null,
    github_repo: null,
    github_project_item_id: null,
    labels: null,
    assignees: null,
    milestone: null,
    metadata: null,
    github_sync_pending: 0,
    github_sync_retry_count: 0,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('rowToTask', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('throws ZodError when status is unknown value', () => {
    const row = makeRow({ status: 'unknown_status' });
    expect(() => rowToTask(row)).toThrow();
  });

  it('returns { status: "backlog" } variant with no reviewReason field', () => {
    const row = makeRow({ status: 'backlog', review_reason: null });
    const result = rowToTask(row);
    expect(result.status).toBe('backlog');
    expect((result as any).reviewReason).toBeUndefined();
  });

  it('returns { status: "error", reviewReason: "completed" } variant', () => {
    const row = makeRow({ status: 'error', review_reason: 'completed' });
    const result = rowToTask(row);
    expect(result.status).toBe('error');
    expect((result as any).reviewReason).toBe('completed');
  });

  it('returns { status: "error" } with reviewReason undefined when review_reason is null (non-strict DB rows)', () => {
    const row = makeRow({ status: 'error', review_reason: null });
    const result = rowToTask(row);
    expect(result.status).toBe('error');
    expect((result as any).reviewReason).toBeUndefined();
  });

  it('returns { status: "pr_created" } with githubIssueNumber, githubIssueUrl, githubRepo', () => {
    const row = makeRow({
      status: 'pr_created',
      github_issue_number: 42,
      github_issue_url: 'https://github.com/o/r/issues/42',
      github_repo: 'o/r',
    });
    const result = rowToTask(row);
    expect(result.status).toBe('pr_created');
    expect((result as any).githubIssueNumber).toBe(42);
    expect((result as any).githubIssueUrl).toBe('https://github.com/o/r/issues/42');
    expect((result as any).githubRepo).toBe('o/r');
  });
});

describe('buildSyncState', () => {
  it('buildSyncState(0, 0) returns { kind: "idle" }', () => {
    expect(buildSyncState(0, 0)).toEqual({ kind: 'idle' });
  });

  it('buildSyncState(1, 0) returns { kind: "pending" }', () => {
    expect(buildSyncState(1, 0)).toEqual({ kind: 'pending' });
  });

  it('buildSyncState(1, 3) returns { kind: "retrying", retryCount: 3 }', () => {
    expect(buildSyncState(1, 3)).toEqual({ kind: 'retrying', retryCount: 3 });
  });

  it('buildSyncState(0, 2) returns { kind: "failed", retryCount: 2 }', () => {
    expect(buildSyncState(0, 2)).toEqual({ kind: 'failed', retryCount: 2 });
  });
});

describe('buildCreateTaskInput', () => {
  it('returns object with correct fields for basic input', () => {
    const input = { productId: 'prod-1', title: 'T', description: 'D', status: 'backlog' as const };
    const result = buildCreateTaskInput(input, 'id-1', '2026-01-01T00:00:00');
    expect(result.id).toBe('id-1');
    expect(result.status).toBe('backlog');
    expect(result.labels).toBe('[]');
    expect(result.metadata).toBe('{}');
  });

  it('defaults undefined optional fields to null or empty serialized values', () => {
    const input = { productId: 'prod-1', title: 'T', description: 'D', status: 'backlog' as const };
    const result = buildCreateTaskInput(input, 'id-1', '2026-01-01T00:00:00');
    expect(result.priority).toBeNull();
    expect(result.category).toBeNull();
    expect(result.github_issue_number).toBeNull();
    expect(result.github_issue_url).toBeNull();
    expect(result.github_repo).toBeNull();
    expect(result.github_project_item_id).toBeNull();
    expect(result.assignees).toBe('[]');
  });
});

describe('buildUpdateTaskFields', () => {
  it('buildUpdateTaskFields({ title: "New Title" }) returns { updates: ["title = ?"], values: ["New Title"] }', () => {
    const result = buildUpdateTaskFields({ title: 'New Title' });
    expect(result.updates).toEqual(['title = ?']);
    expect(result.values).toEqual(['New Title']);
  });

  it('buildUpdateTaskFields({}) returns { updates: [], values: [] } for empty input', () => {
    const result = buildUpdateTaskFields({});
    expect(result.updates).toEqual([]);
    expect(result.values).toEqual([]);
  });
});
