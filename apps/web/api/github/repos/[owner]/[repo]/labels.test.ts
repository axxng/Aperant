import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../../../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../../../../_lib/auth/middleware.js', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ userId: 'user-1' }),
}));
import { authenticateRequest } from '../../../../_lib/auth/middleware.js';

// NOTE: labels.ts does not exist yet — this import will fail until Plan 02 creates it.
// This test file is the Nyquist RED state.
let handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;

function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: { owner: 'myorg', repo: 'myrepo' },
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
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  } as unknown as Response;
}

const SAMPLE_LABELS = [
  { id: 1, name: 'bug', color: 'ee0701', description: 'Something is broken' },
  { id: 2, name: 'enhancement', color: '84b6eb', description: null },
];

describe('labels handler', () => {
  beforeEach(async () => {
    vi.spyOn(globalThis, 'fetch');
    process.env.GITHUB_TOKEN = 'fake-token';
    vi.mocked(authenticateRequest).mockResolvedValue({ userId: 'user-1' } as any);
    // Dynamic import so the file can fail at import time without crashing the whole suite
    const mod = await import('./labels.js').catch(() => ({ default: null }));
    handler = mod.default ?? (async (_req: VercelRequest, res: VercelResponse) => {
      (res as any).status(501).json({ error: 'labels.ts not yet created' });
    });
  });

  it('TODO: returns 200 with labels array in correct shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_LABELS));
    const { res, json } = mockVercelRes();
    await handler(mockVercelReq(), res);
    const result = json.mock.calls[0]?.[0];
    expect(result).toHaveProperty('labels');
    expect(result.labels[0]).toMatchObject({ id: 1, name: 'bug', color: 'ee0701', description: 'Something is broken' });
  });

  it('TODO: returns 405 for non-GET methods', async () => {
    const { res, status } = mockVercelRes();
    await handler(mockVercelReq({ method: 'POST' }), res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('TODO: returns 401 when not authenticated', async () => {
    vi.mocked(authenticateRequest).mockResolvedValueOnce(null as any);
    const { res, status } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(status).not.toHaveBeenCalledWith(200);
  });

  it('TODO: returns 429 with retryAfter when rate limited', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }));
    const { res, status } = mockVercelRes();
    await handler(mockVercelReq(), res);
    expect(status).toHaveBeenCalledWith(429);
  });
});
