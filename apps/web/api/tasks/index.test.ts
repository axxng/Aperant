import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'member' }),
  hasRole: vi.fn().mockReturnValue(true),
}));
vi.mock('../_lib/db/tasks.js', () => ({
  getAllTasks: vi.fn().mockResolvedValue([]),
  getTasksByProduct: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  getTaskByGitHubIssue: vi.fn(),
}));
vi.mock('../_lib/validation.js', () => ({
  createTaskSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: {
        productId: 'prod-uuid-1',
        title: 'Fix login bug',
        description: '',
        status: 'backlog',
        githubIssueNumber: 42,
        githubIssueUrl: 'https://github.com/org/repo/issues/42',
        githubRepo: 'org/repo',
      },
    }),
  },
}));
vi.mock('../_lib/events.js', () => ({ broadcastEvent: vi.fn() }));

import handler from './index.js';
import { createTask, getTaskByGitHubIssue } from '../_lib/db/tasks.js';

function mockVercelReq(overrides = {}) {
  return {
    method: 'POST',
    body: { productId: 'prod-uuid-1', title: 'Fix login bug', description: '', status: 'backlog', githubIssueNumber: 42, githubIssueUrl: 'https://github.com/org/repo/issues/42', githubRepo: 'org/repo' },
    query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as VercelResponse, json, status };
}

describe('POST /api/tasks — PROMOTE-05: duplicate guard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 409 with existing task when UNIQUE constraint is violated', async () => {
    vi.mocked(createTask).mockRejectedValue(
      new Error('UNIQUE constraint failed: tasks.github_repo, tasks.github_issue_number')
    );
    const existingTask = { id: 'existing-1', title: 'Fix login bug' };
    vi.mocked(getTaskByGitHubIssue).mockResolvedValue(existingTask as any);

    const { res, status, json } = mockVercelRes();
    await handler(mockVercelReq(), res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: 'This issue is already in the backlog.',
      existingTask,
    });
  });
});
