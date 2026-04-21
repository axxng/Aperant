import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures mockExecute is available inside the vi.mock factory (Vitest hoists vi.mock to top of file)
const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));

vi.mock('./client.js', () => ({
  getClient: vi.fn().mockReturnValue({ execute: mockExecute }),
}));

import { upsertOAuthUser, userCount } from './users.js';

describe('upsertOAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUTH-06: SQL includes ON CONFLICT(email) DO UPDATE SET — does NOT include role in update', async () => {
    // Mock execute to return something for the upsert and the follow-up SELECT
    mockExecute
      .mockResolvedValueOnce({ rows: [] }) // upsert INSERT
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@github.com', name: 'Alice', role: 'admin', github_login: 'alice', github_token: 'gho_token', password_hash: null, created_at: '', updated_at: '' }] }); // SELECT after upsert

    await upsertOAuthUser({
      githubId: '1',
      email: 'alice@github.com',
      name: 'Alice',
      githubLogin: 'alice',
      githubToken: 'gho_token',
      role: 'member', // passed as member but existing admin role must be preserved by SQL
    });

    const [upsertCall] = mockExecute.mock.calls;
    const sql: string = upsertCall?.[0]?.sql ?? '';
    // Must contain ON CONFLICT upsert
    expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET');
    // Must NOT update role column (preserves existing admin)
    expect(sql).not.toMatch(/DO UPDATE SET[^;]*\brole\b/s);
  });

  it('AUTH-06: sets github_token and github_login for new user', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@github.com', name: 'Alice', role: 'admin', github_login: 'alice', github_token: 'gho_token', password_hash: null, created_at: '', updated_at: '' }] });

    const user = await upsertOAuthUser({
      githubId: '1', email: 'alice@github.com', name: 'Alice',
      githubLogin: 'alice', githubToken: 'gho_token', role: 'admin',
    });

    expect(user.github_token).toBe('gho_token');
    expect(user.github_login).toBe('alice');
  });
});

describe('userCount', () => {
  it('returns count from SELECT COUNT(*) result', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const count = await userCount();
    expect(count).toBe(3);
  });
});
