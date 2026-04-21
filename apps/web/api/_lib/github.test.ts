import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubRateLimitError, githubFetch } from './github.js';

const FAKE_TOKEN = 'fake-token';

function mockResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

describe('GitHubRateLimitError', () => {
  it('is an instance of Error', () => {
    const err = new GitHubRateLimitError(60);
    expect(err).toBeInstanceOf(Error);
    expect(err.retryAfter).toBe(60);
    expect(err.name).toBe('GitHubRateLimitError');
  });
});

describe('githubFetch rate-limit detection', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  it('throws GitHubRateLimitError on 429 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 120) }));
    await expect(githubFetch(FAKE_TOKEN, 'https://api.github.com/test')).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it('throws GitHubRateLimitError on 403 with x-ratelimit-remaining=0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60) }));
    await expect(githubFetch(FAKE_TOKEN, 'https://api.github.com/test')).rejects.toBeInstanceOf(GitHubRateLimitError);
  });

  it('throws GitHubRateLimitError on secondary rate limit (retry-after header present)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(429, { 'retry-after': '30' }));
    const err = await githubFetch(FAKE_TOKEN, 'https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBe(30);
  });

  it('derives retryAfter from x-ratelimit-reset for primary limits', async () => {
    const resetTs = Math.floor(Date.now() / 1000) + 120;
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(resetTs) }));
    const err = await githubFetch(FAKE_TOKEN, 'https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBeGreaterThan(0);
    expect(err.retryAfter).toBeLessThanOrEqual(120);
  });

  it('falls back to 60 when no rate-limit headers present on 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(429, {}));
    const err = await githubFetch(FAKE_TOKEN, 'https://api.github.com/test').catch(e => e);
    expect(err).toBeInstanceOf(GitHubRateLimitError);
    expect(err.retryAfter).toBe(60);
  });

  it('does NOT throw GitHubRateLimitError for auth failure 403 (no rate-limit headers)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(403, {}));
    const result = await githubFetch(FAKE_TOKEN, 'https://api.github.com/test');
    expect(result.status).toBe(403);
  });
});
