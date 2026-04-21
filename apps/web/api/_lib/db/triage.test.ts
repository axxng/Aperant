import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getClient before importing triage module
const mockExecute = vi.fn();
vi.mock('./client.js', () => ({
  getClient: () => ({ execute: mockExecute }),
}));

import { getTriageRecord, upsertTriageRecord } from './triage.js';

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

  it('calls execute with ON CONFLICT upsert SQL', async () => {
    // First execute: the upsert INSERT
    mockExecute.mockResolvedValueOnce({});
    // Second execute: the SELECT after upsert to return updated record
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
    // Verify INSERT...ON CONFLICT SQL was called
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('ON CONFLICT'),
    }));
    expect(result.isTriaged).toBe(true);
    expect(result.priority).toBe('high');
  });
});
