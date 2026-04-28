import { describe, it, expect, vi } from 'vitest';

describe('getClient() — MOCK_SERVICES gate', () => {
  it('MOCK-01: returns file:dev.db client when MOCK_SERVICES=true', async () => {
    // Use vi.doMock (non-hoisted) so we can control env before the mock runs
    vi.resetModules();
    process.env.MOCK_SERVICES = 'true';
    delete process.env.TURSO_DATABASE_URL;

    const mockCreateClient = vi.fn().mockReturnValue({
      execute: vi.fn(),
      executeMultiple: vi.fn(),
    });
    vi.doMock('@libsql/client', () => ({ createClient: mockCreateClient }));

    const { getClient } = await import('./client.js');
    getClient();

    expect(mockCreateClient).toHaveBeenCalledWith({ url: 'file:dev.db' });

    vi.doUnmock('@libsql/client');
    delete process.env.MOCK_SERVICES;
  });

  it('MOCK-02: returns Turso client when MOCK_SERVICES is unset', async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';

    const mockCreateClient = vi.fn().mockReturnValue({
      execute: vi.fn(),
      executeMultiple: vi.fn(),
    });
    vi.doMock('@libsql/client', () => ({ createClient: mockCreateClient }));

    const { getClient } = await import('./client.js');
    getClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'libsql://test.turso.io' })
    );

    vi.doUnmock('@libsql/client');
    delete process.env.TURSO_DATABASE_URL;
  });
});
