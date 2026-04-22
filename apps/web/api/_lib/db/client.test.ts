import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock @libsql/client to intercept createClient calls
const mockCreateClient = vi.fn().mockReturnValue({
  execute: vi.fn().mockResolvedValue({ rows: [] }),
  executeMultiple: vi.fn().mockResolvedValue(undefined),
});
vi.mock('@libsql/client', () => ({
  createClient: mockCreateClient,
}));

describe('getClient() — MOCK_SERVICES gate', () => {
  afterEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
    delete process.env.MOCK_SERVICES;
    delete process.env.TURSO_DATABASE_URL;
  });

  it('MOCK-01: returns file:dev.db client when MOCK_SERVICES=true', async () => {
    process.env.MOCK_SERVICES = 'true';
    const { getClient } = await import('./client.js');
    getClient();
    expect(mockCreateClient).toHaveBeenCalledWith({ url: 'file:dev.db' });
  });

  it('MOCK-02: returns Turso client when MOCK_SERVICES is unset', async () => {
    process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';
    const { getClient } = await import('./client.js');
    getClient();
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'libsql://test.turso.io' })
    );
  });
});
