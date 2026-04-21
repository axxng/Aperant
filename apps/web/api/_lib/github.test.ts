import { describe, it, expect, vi, beforeEach } from 'vitest';

const FAKE_TOKEN = 'fake-token';

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
    process.env.GITHUB_TOKEN = FAKE_TOKEN;
  });

  it('passes token in Authorization: Bearer header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${FAKE_TOKEN}`);
  });

  it('passes X-GitHub-Api-Version header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('passes Accept: application/vnd.github.v3+json header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, {}));
    await githubFetch('https://api.github.com/user');
    const [_url, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/vnd.github.v3+json');
  });

  it('throws GitHubRateLimitError on 429 with retry-after header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));
    const err = await githubFetch('https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBe(30);
  });

  it('throws GitHubRateLimitError on 403 with x-ratelimit-remaining: 0', async () => {
    const resetTs = Math.floor(Date.now() / 1000) + 120;
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetTs) }));
    const err = await githubFetch('https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBeGreaterThan(0);
  });

  it('derives retryAfter from x-ratelimit-reset for primary rate limits', async () => {
    const resetTs = Math.floor(Date.now() / 1000) + 120;
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetTs) }));
    const err = await githubFetch('https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBeGreaterThan(0);
    expect(err.retryAfter).toBeLessThanOrEqual(120);
  });

  it('falls back to 60 when no rate-limit headers on 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}));
    const err = await githubFetch('https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBe(60);
  });

  it('does NOT throw GitHubRateLimitError for auth failure 403 without rate-limit headers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(403, {}));
    const result = await githubFetch('https://api.github.com/test');
    expect(result.status).toBe(403);
  });

  it('returns response on 200', async () => {
    const mockRes = mockFetchResponse(200, { login: 'alice' });
    vi.mocked(fetch).mockResolvedValueOnce(mockRes);
    const result = await githubFetch('https://api.github.com/user');
    expect(result.status).toBe(200);
  });
});
