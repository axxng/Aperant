import { describe, it, expect, vi, beforeEach } from 'vitest';

// NOTE: github.ts does not yet have the new signature — these tests are RED until Plan 02 updates it.
// Import will work since the file exists; tests will fail when githubFetch is called with wrong arg order.

vi.mock('./config-resolver.js', () => ({
  resolveConfig: vi.fn().mockResolvedValue('old-token'),
}));

import { githubFetch, GitHubRateLimitError } from './github.js';

function mockFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status, ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe('githubFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch');
  });

  it('passes token in Authorization: Bearer header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('test-token-123', 'https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token-123');
  });

  it('passes X-GitHub-Api-Version header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('test-token', 'https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('passes Accept: application/vnd.github.v3+json header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('test-token', 'https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/vnd.github.v3+json');
  });

  it('throws GitHubRateLimitError on 429 with retry-after header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }));
    await expect(githubFetch('test-token', 'https://api.github.com/user')).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it('throws GitHubRateLimitError on 403 with x-ratelimit-remaining: 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 300) }));
    await expect(githubFetch('test-token', 'https://api.github.com/user')).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it('returns response on 200', async () => {
    const mockRes = mockFetchResponse(200, { login: 'alice' });
    vi.mocked(fetch).mockResolvedValueOnce(mockRes);
    const result = await githubFetch('test-token', 'https://api.github.com/user');
    expect(result.status).toBe(200);
  });
});
