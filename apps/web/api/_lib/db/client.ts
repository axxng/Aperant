import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;
let migrated = false;

export function getClient(): Client {
  if (!client) {
    if (process.env.MOCK_SERVICES === 'true') {
      if (process.env.VERCEL) throw new Error('MOCK_SERVICES=true must not be set in Vercel deployments');
      client = createClient({ url: 'file:dev.db' });
    } else {
      client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    }
  }
  return client;
}

export async function ensureDb(): Promise<Client> {
  const c = getClient();
  if (!migrated) {
    await runMigrations(c);
    migrated = true;
  }
  return c;
}

async function runMigrations(c: Client): Promise<void> {
  await c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const result = await c.execute('SELECT name FROM migrations');
  const applied = new Set(result.rows.map((r: any) => r.name as string));

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      await c.executeMultiple(migration.sql);
      await c.execute({
        sql: 'INSERT INTO migrations (name) VALUES (?)',
        args: [migration.name],
      });
      console.log(`Applied migration: ${migration.name}`);
    }
  }
}


const MIGRATIONS = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        sources TEXT NOT NULL DEFAULT '[]',
        status_mapping TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'backlog',
        review_reason TEXT,
        priority TEXT,
        category TEXT,
        github_issue_number INTEGER,
        github_issue_url TEXT,
        github_repo TEXT,
        github_project_item_id TEXT,
        labels TEXT DEFAULT '[]',
        assignees TEXT DEFAULT '[]',
        milestone TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_product ON tasks(product_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_github ON tasks(github_repo, github_issue_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_unique ON tasks(github_repo, github_issue_number) WHERE github_repo IS NOT NULL AND github_issue_number IS NOT NULL;

      CREATE TABLE IF NOT EXISTS task_order (
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        task_ids TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (scope, status)
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        source_key TEXT NOT NULL,
        last_synced_at TEXT,
        etag TEXT,
        cursor TEXT,
        PRIMARY KEY (product_id, source_key)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    name: '006_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
  {
    name: '007_otp_auth',
    sql: `
      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

      CREATE TABLE IF NOT EXISTS users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO users_new SELECT * FROM users;
      DROP TABLE IF EXISTS users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `,
  },
  {
    name: '008_events',
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
    `,
  },
  {
    name: '009_github_sync_pending',
    sql: `
      ALTER TABLE tasks ADD COLUMN github_sync_pending INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_tasks_sync_pending ON tasks(github_sync_pending) WHERE github_sync_pending = 1;
    `,
  },
  {
    name: '010_github_sync_retry_count',
    sql: `
      ALTER TABLE tasks ADD COLUMN github_sync_retry_count INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    name: '011_issue_triage',
    sql: `
      CREATE TABLE IF NOT EXISTS issue_triage (
        github_repo TEXT NOT NULL,
        github_issue_number INTEGER NOT NULL,
        is_triaged INTEGER NOT NULL DEFAULT 0,
        priority TEXT DEFAULT NULL,
        github_comment_id INTEGER DEFAULT NULL,
        comment_status TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (github_repo, github_issue_number)
      );
    `,
  },
  {
    name: '012_github_oauth',
    sql: `
      DROP TABLE IF EXISTS otp_codes;
      ALTER TABLE users ADD COLUMN github_token TEXT;
      ALTER TABLE users ADD COLUMN github_login TEXT;
    `,
  },
];
