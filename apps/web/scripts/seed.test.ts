import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createClient } from '@libsql/client';

// Use in-memory SQLite so seed tests are isolated from any real dev.db
const inMemoryClient = createClient({ url: ':memory:' });
let migrated = false;

vi.mock('../api/_lib/db/client.js', () => ({
  getClient: () => inMemoryClient,
  ensureDb: async () => {
    // Run migrations once on in-memory DB so seed can insert rows
    if (!migrated) {
      // Minimal schema matching what seed.ts needs
      await inMemoryClient.executeMultiple(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'member',
          github_login TEXT,
          github_token TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT NOT NULL DEFAULT '#3B82F6',
          sources TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'backlog',
          review_reason TEXT,
          priority TEXT,
          github_issue_number INTEGER,
          github_issue_url TEXT,
          github_repo TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS task_order (
          scope TEXT NOT NULL,
          status TEXT NOT NULL,
          task_ids TEXT NOT NULL DEFAULT '[]',
          PRIMARY KEY (scope, status)
        );
        CREATE TABLE IF NOT EXISTS issue_triage (
          github_repo TEXT NOT NULL,
          github_issue_number INTEGER NOT NULL,
          is_triaged INTEGER NOT NULL DEFAULT 0,
          priority TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (github_repo, github_issue_number)
        );
      `);
      migrated = true;
    }
    return inMemoryClient;
  },
}));

describe('seed script (MOCK-04)', () => {
  beforeAll(async () => {
    process.env.MOCK_SERVICES = 'true';
    // Import seed.ts — will fail until scripts/seed.ts exists
    await import('./seed.js');
  });

  afterAll(() => {
    delete process.env.MOCK_SERVICES;
  });

  it('MOCK-04a: creates exactly 1 admin user', async () => {
    const result = await inMemoryClient.execute('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
    expect(Number(result.rows[0]!.count)).toBe(1);
  });

  it('MOCK-04b: creates exactly 3 products', async () => {
    const result = await inMemoryClient.execute('SELECT COUNT(*) as count FROM products');
    expect(Number(result.rows[0]!.count)).toBe(3);
  });

  it('MOCK-04c: creates tasks in all 8 Kanban statuses', async () => {
    const statuses = ['backlog', 'queue', 'in_progress', 'ai_review', 'human_review', 'done', 'pr_created', 'error'];
    for (const status of statuses) {
      const result = await inMemoryClient.execute(
        'SELECT COUNT(*) as count FROM tasks WHERE status = ?',
        [status]
      );
      expect(Number(result.rows[0]!.count), `expected tasks with status '${status}'`).toBeGreaterThan(0);
    }
  });

  it('MOCK-04d: pr_created tasks have required github_issue_number, github_issue_url, github_repo', async () => {
    const result = await inMemoryClient.execute(
      `SELECT * FROM tasks WHERE status = 'pr_created' AND (github_issue_number IS NULL OR github_issue_url IS NULL OR github_repo IS NULL)`
    );
    expect(result.rows.length).toBe(0);
  });
});
