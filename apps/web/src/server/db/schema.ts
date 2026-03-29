import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'aperant.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    database.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
  );

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      database.transaction(() => {
        database.exec(migration.sql);
        database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      })();
      console.log(`Applied migration: ${migration.name}`);
    }
  }
}

const MIGRATIONS = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        sources TEXT NOT NULL DEFAULT '[]',
        status_mapping TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE tasks (
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

      CREATE INDEX idx_tasks_product ON tasks(product_id);
      CREATE INDEX idx_tasks_status ON tasks(status);
      CREATE INDEX idx_tasks_github ON tasks(github_repo, github_issue_number);
      CREATE UNIQUE INDEX idx_tasks_github_unique ON tasks(github_repo, github_issue_number) WHERE github_repo IS NOT NULL AND github_issue_number IS NOT NULL;

      CREATE TABLE task_order (
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        task_ids TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (scope, status)
      );

      CREATE TABLE sync_state (
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        source_key TEXT NOT NULL,
        last_synced_at TEXT,
        etag TEXT,
        cursor TEXT,
        PRIMARY KEY (product_id, source_key)
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    name: '002_insights_sessions',
    sql: `
      CREATE TABLE insights_sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        messages TEXT NOT NULL DEFAULT '[]',
        model_config TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: '003_roadmaps',
    sql: `
      CREATE TABLE roadmaps (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        vision TEXT NOT NULL DEFAULT '',
        target_audience TEXT NOT NULL DEFAULT '',
        phases TEXT NOT NULL DEFAULT '[]',
        features TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_roadmaps_product ON roadmaps(product_id);
    `,
  },
];
