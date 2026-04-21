import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../../../_lib/db/client.js', () => ({ ensureDb: vi.fn() }));
vi.mock('../../../_lib/db/users.js', () => ({
  upsertOAuthUser: vi.fn(),
  userCount: vi.fn().mockResolvedValue(0),
}));
vi.mock('../../../_lib/auth/jwt.js', () => ({
  createToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

import { upsertOAuthUser, userCount } from '../../../_lib/db/users.js';

function mockVercelReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    query: {},
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function mockVercelRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  const redirect = vi.fn();
  const setHeader = vi.fn();
  return { res: { json, status, redirect, setHeader } as unknown as VercelResponse, json, status, redirect, setHeader };
}

let handler: ((req: VercelRequest, res: VercelResponse) => Promise<void>) | null = null;

describe('OAuth callback handler', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch');
    const mod = await import('./callback.js').catch(() => ({ default: null }));
    handler = (mod.default as any) ?? (async (_req: VercelRequest, res: VercelResponse) => {
      (res as any).status(501).json({ error: 'callback.ts not yet created' });
    });
  });

  it('AUTH-02: returns 400 when state cookie does not match query state', async () => {
    const req = mockVercelReq({
      query: { code: 'github-code', state: 'wrong-state' },
      headers: { cookie: 'oauth_state=correct-state' },
    });
    const { res, status } = mockVercelRes();
    await handler!(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('AUTH-02: returns 400 when oauth_state cookie is missing', async () => {
    const req = mockVercelReq({
      query: { code: 'github-code', state: 'some-state' },
      headers: {},
    });
    const { res, status } = mockVercelRes();
    await handler!(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('AUTH-03: returns 400 when code query param is missing', async () => {
    const req = mockVercelReq({
      query: { state: 'abc123' },
      headers: { cookie: 'oauth_state=abc123' },
    });
    const { res, status } = mockVercelRes();
    await handler!(req, res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('AUTH-04: first user (userCount=0) gets role=admin', async () => {
    vi.mocked(userCount).mockResolvedValueOnce(0);
    vi.mocked(upsertOAuthUser).mockResolvedValueOnce({ id: 'user-1', email: 'alice@github.com', name: 'Alice', role: 'admin', github_login: 'alice', github_token: 'gho_token', password_hash: null, created_at: '', updated_at: '' } as any);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_token' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, login: 'alice', email: 'alice@github.com', name: 'Alice' }) } as any);
    const req = mockVercelReq({
      query: { code: 'valid-code', state: 'abc123' },
      headers: { cookie: 'oauth_state=abc123' },
    });
    const { res } = mockVercelRes();
    await handler!(req, res);
    expect(upsertOAuthUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('AUTH-04: second user (userCount=1) gets role=member', async () => {
    vi.mocked(userCount).mockResolvedValueOnce(1);
    vi.mocked(upsertOAuthUser).mockResolvedValueOnce({ id: 'user-2', email: 'bob@github.com', name: 'Bob', role: 'member', github_login: 'bob', github_token: 'gho_bob', password_hash: null, created_at: '', updated_at: '' } as any);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_bob' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 2, login: 'bob', email: 'bob@github.com', name: 'Bob' }) } as any);
    const req = mockVercelReq({
      query: { code: 'valid-code', state: 'abc123' },
      headers: { cookie: 'oauth_state=abc123' },
    });
    const { res } = mockVercelRes();
    await handler!(req, res);
    expect(upsertOAuthUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'member' }));
  });

  it('AUTH-05: redirects to /?token= after successful OAuth', async () => {
    vi.mocked(userCount).mockResolvedValueOnce(0);
    vi.mocked(upsertOAuthUser).mockResolvedValueOnce({ id: 'user-1', email: 'alice@github.com', name: 'Alice', role: 'admin', github_login: 'alice', github_token: 'gho_token', password_hash: null, created_at: '', updated_at: '' } as any);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_token' }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1, login: 'alice', email: 'alice@github.com', name: 'Alice' }) } as any);
    const req = mockVercelReq({
      query: { code: 'valid-code', state: 'abc123' },
      headers: { cookie: 'oauth_state=abc123' },
    });
    const { res, redirect } = mockVercelRes();
    await handler!(req, res);
    expect(redirect).toHaveBeenCalledWith(302, expect.stringContaining('/?token='));
  });
});
