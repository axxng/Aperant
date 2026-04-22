import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getClient before importing triage module
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));

import { getTriageRecord, upsertTriageRecord, getTriageRecordsBatch } from './triage.js';

describe('getTriageRecord', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('returns null when no record exists', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTriageRecord('owner/repo', 1);
    expect(result).toBeNull();
  });

  it('returns mapped TriageRecord when row exists', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo',
        github_issue_number: 1,
        is_triaged: 1,
        priority: 'high',
        github_comment_id: null,
        comment_status: null,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-01T00:00:00',
      }],
    });
    const result = await getTriageRecord('owner/repo', 1);
    expect(result).not.toBeNull();
    expect(result!.isTriaged).toBe(true);
    expect(result!.priority).toBe('high');
    expect(result!.githubCommentId).toBeNull();
    expect(result!.commentStatus).toBeNull();
  });
});

describe('upsertTriageRecord', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('calls two execute steps: INSERT DO NOTHING then dynamic UPDATE then SELECT', async () => {
    // Step 1: INSERT DO NOTHING (ensure row exists)
    mockExecute.mockResolvedValueOnce({});
    // Step 2: dynamic UPDATE
    mockExecute.mockResolvedValueOnce({});
    // Step 3: SELECT after update to return updated record
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo',
        github_issue_number: 1,
        is_triaged: 1,
        priority: 'high',
        github_comment_id: null,
        comment_status: null,
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-02T00:00:00',
      }],
    });
    const result = await upsertTriageRecord('owner/repo', 1, { isTriaged: true, priority: 'high' });
    // Verify INSERT with DO NOTHING was called first
    expect(mockExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sql: expect.stringContaining('DO NOTHING'),
    }));
    // Verify dynamic UPDATE was called with both fields
    expect(mockExecute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      sql: expect.stringContaining('UPDATE issue_triage'),
    }));
    expect(result.isTriaged).toBe(true);
    expect(result.priority).toBe('high');
  });
});

describe('getTriageRecordsBatch', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('returns [] immediately when issueNumbers is empty (no DB call)', async () => {
    const result = await getTriageRecordsBatch('owner/repo', []);
    expect(result).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('queries with repo and all issue numbers as args and maps results', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { github_issue_number: 1, is_triaged: 1, priority: 'high' },
        { github_issue_number: 2, is_triaged: 0, priority: null },
      ],
    });
    const result = await getTriageRecordsBatch('owner/repo', [1, 2, 5]);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('github_issue_number IN'),
      args: ['owner/repo', 1, 2, 5],
    }));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ issueNumber: 1, isTriaged: true, priority: 'high' });
    expect(result[1]).toEqual({ issueNumber: 2, isTriaged: false, priority: null });
  });

  it('maps is_triaged=0 with non-null priority as isTriaged=false', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ github_issue_number: 3, is_triaged: 0, priority: 'medium' }],
    });
    const result = await getTriageRecordsBatch('owner/repo', [3]);
    expect(result[0]).toEqual({ issueNumber: 3, isTriaged: false, priority: 'medium' });
  });
});

describe('upsertTriageRecord — NOTES-02: comment fields', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('saves githubCommentId and commentStatus to triage record', async () => {
    // Step 1: INSERT ON CONFLICT DO UPDATE
    mockExecute.mockResolvedValueOnce({});
    // Step 2: SELECT via getTriageRecord
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo',
        github_issue_number: 42,
        is_triaged: 0,
        priority: null,
        github_comment_id: 123456,
        comment_status: 'posted',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-02T00:00:00',
      }],
    });
    const result = await upsertTriageRecord('owner/repo', 42, { githubCommentId: 123456, commentStatus: 'posted' });
    // Verify INSERT includes github_comment_id and comment_status columns
    expect(mockExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sql: expect.stringContaining('github_comment_id'),
      args: expect.arrayContaining([123456, 'posted']),
    }));
    expect(result.githubCommentId).toBe(123456);
    expect(result.commentStatus).toBe('posted');
  });

  it('preserves existing github_comment_id when not in updates', async () => {
    // Step 1: INSERT ON CONFLICT DO UPDATE
    mockExecute.mockResolvedValueOnce({});
    // Step 2: SELECT via getTriageRecord — existing comment id preserved
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo',
        github_issue_number: 42,
        is_triaged: 1,
        priority: 'high',
        github_comment_id: 999,
        comment_status: 'posted',
        created_at: '2026-01-01T00:00:00',
        updated_at: '2026-01-02T00:00:00',
      }],
    });
    const result = await upsertTriageRecord('owner/repo', 42, { isTriaged: true, priority: 'high' });
    // SQL should preserve existing github_comment_id (not update it)
    expect(mockExecute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      sql: expect.stringContaining('issue_triage.github_comment_id'),
    }));
    expect(result.githubCommentId).toBe(999);
  });
});

describe('TriageState via rowToTriage', () => {
  beforeEach(() => { mockExecute.mockReset(); });

  it('maps is_triaged=0 to { kind: "untouched" }', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo', github_issue_number: 1,
        is_triaged: 0, priority: null,
        github_comment_id: null, comment_status: null,
        created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
      }],
    });
    const result = await getTriageRecord('owner/repo', 1);
    expect(result?.triageState).toEqual({ kind: 'untouched' });
  });

  it('maps is_triaged=1 with priority to { kind: "prioritized", priority }', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo', github_issue_number: 1,
        is_triaged: 1, priority: 'high',
        github_comment_id: null, comment_status: null,
        created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
      }],
    });
    const result = await getTriageRecord('owner/repo', 1);
    expect(result?.triageState).toEqual({ kind: 'prioritized', priority: 'high' });
  });

  it('maps is_triaged=1 with priority=null to { kind: "complete" }', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        github_repo: 'owner/repo', github_issue_number: 1,
        is_triaged: 1, priority: null,
        github_comment_id: null, comment_status: null,
        created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
      }],
    });
    const result = await getTriageRecord('owner/repo', 1);
    expect(result?.triageState).toEqual({ kind: 'complete' });
  });
});
