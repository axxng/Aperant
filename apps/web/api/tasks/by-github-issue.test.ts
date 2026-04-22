import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'member' }),
  hasRole: vi.fn().mockReturnValue(true),
}));
vi.mock('../_lib/db/tasks.js', () => ({
  getTaskByGitHubIssue: vi.fn(),
}));

import handler from './by-github-issue.js';
import { getTaskByGitHubIssue } from '../_lib/db/tasks.js';
import { authenticateRequest, hasRole } from '../_lib/auth/middleware.js';

function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: { repo: 'org/repo', number: '42' },
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as VercelResponse, json, status };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/tasks/by-github-issue', () => {
  it('returns task when getTaskByGitHubIssue resolves to a task', async () => {
    const task = { id: 'task-1', title: 'Fix login bug' };
    vi.mocked(getTaskByGitHubIssue).mockResolvedValue(task as any);
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(json).toHaveBeenCalledWith(task);
  });

  it('returns null when getTaskByGitHubIssue resolves to null', async () => {
    vi.mocked(getTaskByGitHubIssue).mockResolvedValue(null);
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(json).toHaveBeenCalledWith(null);
  });

  it('returns 405 when method is not GET', async () => {
    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq({ method: 'POST' }), res);
    expect(status).toHaveBeenCalledWith(405);
    expect(json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('returns 403 when user has insufficient role', async () => {
    vi.mocked(hasRole).mockReturnValue(false);
    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(status).toHaveBeenCalledWith(403);
  });
});
