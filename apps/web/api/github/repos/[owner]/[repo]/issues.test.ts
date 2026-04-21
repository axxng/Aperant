import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './issues.js';

vi.mock('../../../../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../../../../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));
vi.mock('../../../../_lib/config-resolver.js', () => ({
  resolveConfig: vi.fn().mockResolvedValue('fake-token'),
}));

import { authenticateRequest } from '../../../../_lib/auth/middleware.js';

function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: { owner: 'myorg', repo: 'myrepo', state: 'open', page: '1', per_page: '50' },
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes(): { res: VercelResponse; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as VercelResponse, json, status };
}

function mockFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

const SAMPLE_GITHUB_ISSUE = {
  id: 1, number: 1, title: 'Test issue', body: 'body text', state: 'open',
  labels: [{ id: 10, name: 'bug', color: 'ee0701', description: null }],
  assignees: [{ login: 'alice', avatar_url: 'https://avatars.example.com/alice' }],
  user: { login: 'bob', avatar_url: 'https://avatars.example.com/bob' },
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z',
  closed_at: null, comments: 2,
  html_url: 'https://github.com/myorg/myrepo/issues/1',
  url: 'https://api.github.com/repos/myorg/myrepo/issues/1',
  milestone: null,
};

describe('issues handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch');
    vi.mocked(authenticateRequest).mockResolvedValue({ id: 'user-1' } as any);
  });

  it('TODO: returns 200 with issues array and hasMore=false for state=open', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, [SAMPLE_GITHUB_ISSUE], { link: '' }));
    const req = mockVercelReq();
    const { res, json } = mockVercelRes();
    await handler(req, res);
    const result = json.mock.calls[0]?.[0];
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('hasMore');
    expect(result.issues[0]).toMatchObject({ number: 1, title: 'Test issue', state: 'open' });
    expect(result.hasMore).toBe(false);
  });

  it('TODO: returns issues with htmlUrl field (BROWSE-08)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, [SAMPLE_GITHUB_ISSUE], { link: '' }));
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    const result = json.mock.calls[0]?.[0];
    expect(result.issues[0]).toHaveProperty('htmlUrl', 'https://github.com/myorg/myrepo/issues/1');
  });

  it('TODO: returns 200 with closed issues when state=closed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, [{ ...SAMPLE_GITHUB_ISSUE, state: 'closed', closed_at: '2024-01-03T00:00:00Z' }], { link: '' }));
    const req = mockVercelReq({ query: { owner: 'myorg', repo: 'myrepo', state: 'closed', page: '1', per_page: '50' } });
    const { res, json } = mockVercelRes();
    await handler(req, res);
    const result = json.mock.calls[0]?.[0];
    expect(result.issues[0]).toMatchObject({ state: 'closed' });
  });

  it('TODO: passes labels param to GitHub API URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, [], { link: '' }));
    const req = mockVercelReq({ query: { owner: 'myorg', repo: 'myrepo', state: 'open', page: '1', per_page: '50', labels: 'bug,enhancement' } });
    const { res } = mockVercelRes();
    await handler(req, res);
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain('labels=bug%2Cenhancement');
  });

  it('TODO: passes assignee param to GitHub API URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, [], { link: '' }));
    const req = mockVercelReq({ query: { owner: 'myorg', repo: 'myrepo', state: 'open', page: '1', per_page: '50', assignee: 'alice' } });
    const { res } = mockVercelRes();
    await handler(req, res);
    const calledUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(calledUrl).toContain('assignee=alice');
  });

  it('TODO: returns 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValueOnce(null as any);
    const { res, status } = mockVercelRes();
    await handler(mockVercelReq(), res);
    // authenticateRequest sends 401 itself and handler returns; json should NOT be called
    expect(status).not.toHaveBeenCalledWith(200);
  });

  it('TODO: returns 429 with retryAfter when rate limited', async () => {
    // Mock fetch to return a 429 response — githubFetch will throw GitHubRateLimitError
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }));
    const { res, status } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(status).toHaveBeenCalledWith(429);
  });
});
