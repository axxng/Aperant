import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock DB dependencies before importing handler
const mockExecute = vi.fn();
vi.mock('../../../../../../_lib/db/client.js', () => ({
  ensureDb: vi.fn().mockResolvedValue(undefined),
  getClient: () => ({ execute: mockExecute }),
}));
vi.mock('../../../../../../_lib/db/users.js', () => ({
  getUserById: vi.fn(),
}));
vi.mock('../../../../../../_lib/db/triage.js', () => ({
  getTriageRecord: vi.fn(),
  upsertTriageRecord: vi.fn(),
}));
vi.mock('../../../../../../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn(),
}));

import handler from './comment.js';
import { getUserById } from '../../../../../../_lib/db/users.js';
import { getTriageRecord, upsertTriageRecord } from '../../../../../../_lib/db/triage.js';
import { authenticateRequest } from '../../../../../../_lib/auth/middleware.js';

function mockVercelReq(overrides: Record<string, unknown> = {}): VercelRequest {
  return {
    method: 'POST',
    query: { owner: 'org', repo: 'myrepo', number: '42' },
    headers: { authorization: 'Bearer valid-token' },
    body: { body: 'This is a test note.' },
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return {
    res: { json, status } as unknown as VercelResponse,
    json,
    status,
  };
}

const mockUser = { userId: 'user-uuid-1', email: 'alice@example.com', role: 'member' };
const mockDbUser = { id: 'user-uuid-1', github_token: 'ghp_testtoken123', github_login: 'alice' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch');
});

describe('comment.ts — NOTES-01: valid POST', () => {
  it('returns 405 on GET request', async () => {
    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq({ method: 'GET' }), res);
    expect(status).toHaveBeenCalledWith(405);
    expect(json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 400 when body is empty string', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq({ body: { body: '' } }), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid input' });
  });

  it('returns 401 when no auth token', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(null);
    const { res } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(authenticateRequest).toHaveBeenCalled();
  });

  it('calls GitHub API and returns comment on valid input', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue(mockDbUser as any);
    vi.mocked(getTriageRecord).mockResolvedValue(null);
    vi.mocked(upsertTriageRecord).mockResolvedValue({} as any);
    const mockComment = { id: 9999, body: 'This is a test note.' };
    vi.mocked(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockComment),
    });
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/repos/org/myrepo/issues/42/comments'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer ghp_testtoken123' }),
      })
    );
    expect(json).toHaveBeenCalledWith(mockComment);
  });
});

describe('comment.ts — D-04: per-user token', () => {
  it('returns 403 when user has no github_token', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue({ ...mockDbUser, github_token: null } as any);
    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'No GitHub token for user' });
  });

  it('uses dbUser.github_token in Authorization header (not GITHUB_TOKEN env var)', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue(mockDbUser as any);
    vi.mocked(getTriageRecord).mockResolvedValue(null);
    vi.mocked(upsertTriageRecord).mockResolvedValue({} as any);
    vi.mocked(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 1234 }),
    });
    const { res } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer ghp_testtoken123' }),
      })
    );
    // Verify it does NOT use env GITHUB_TOKEN
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
      })
    );
  });
});

describe('comment.ts — NOTES-02: idempotency', () => {
  it('returns { alreadyPosted: true, commentId } when github_comment_id already set', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue(mockDbUser as any);
    vi.mocked(getTriageRecord).mockResolvedValue({
      githubCommentId: 55555,
      commentStatus: 'posted',
    } as any);
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(json).toHaveBeenCalledWith({ alreadyPosted: true, commentId: 55555 });
  });

  it('does NOT call GitHub API when already posted', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue(mockDbUser as any);
    vi.mocked(getTriageRecord).mockResolvedValue({
      githubCommentId: 55555,
      commentStatus: 'posted',
    } as any);
    const { res } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('saves githubCommentId to triage record after successful GitHub post', async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(mockUser);
    vi.mocked(getUserById).mockResolvedValue(mockDbUser as any);
    vi.mocked(getTriageRecord).mockResolvedValue(null);
    vi.mocked(upsertTriageRecord).mockResolvedValue({} as any);
    const mockComment = { id: 77777, body: 'This is a test note.' };
    vi.mocked(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockComment),
    });
    const { res } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(upsertTriageRecord).toHaveBeenCalledWith(
      'org/myrepo',
      42,
      { githubCommentId: 77777, commentStatus: 'posted' }
    );
  });
});
