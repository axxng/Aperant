import { config } from 'dotenv';
config({ path: '.env.local' }); // Must load BEFORE importing client (reads MOCK_SERVICES)

if (process.env.MOCK_SERVICES !== 'true') {
  console.error('[seed] ERROR: MOCK_SERVICES must be set to "true" before running seed.');
  console.error('[seed] Refusing to seed — would overwrite real Turso DB.');
  console.error('[seed] Set MOCK_SERVICES=true in .env.local and retry.');
  process.exit(1);
}

import { faker } from '@faker-js/faker';
import { ensureDb } from '../api/_lib/db/client.js';
import { v4 as uuid } from 'uuid';

faker.seed(12345);

const PRODUCT_CONFIGS = [
  { repo: 'project-alpha', color: '#3B82F6' },
  { repo: 'project-beta', color: '#10B981' },
  { repo: 'project-gamma', color: '#F59E0B' },
] as const;

const ALL_STATUSES = [
  'backlog',
  'queue',
  'in_progress',
  'ai_review',
  'human_review',
  'done',
  'pr_created',
  'error',
] as const;

const STATUSES_NEEDING_REVIEW_REASON: string[] = ['ai_review', 'human_review', 'error'];

async function seed(): Promise<void> {
  const db = await ensureDb();

  // Clear existing data for idempotent re-runs (issue_triage first for FK safety)
  await db.executeMultiple(`
    DELETE FROM issue_triage;
    DELETE FROM tasks;
    DELETE FROM task_order;
    DELETE FROM products;
    DELETE FROM users;
  `);

  // ── Seed admin user ──────────────────────────────────────────────────────
  const adminId = uuid();
  await db.execute({
    sql: `INSERT INTO users (id, email, name, role, github_login, github_token)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [adminId, 'dev-admin@github.invalid', 'Dev Admin', 'admin', 'dev-admin', 'mock-token'],
  });
  console.log('[seed] Created admin user: dev-admin@github.invalid');

  // ── Seed products, tasks, and issue_triage ───────────────────────────────
  for (const { repo, color } of PRODUCT_CONFIGS) {
    const productId = uuid();
    const owner = 'mock-org';
    const sources = JSON.stringify([{ type: 'repo', owner, repo }]);

    await db.execute({
      sql: `INSERT INTO products (id, name, description, color, sources) VALUES (?, ?, ?, ?, ?)`,
      args: [productId, faker.company.name(), faker.lorem.sentence(), color, sources],
    });
    console.log(`[seed] Created product: ${repo}`);

    // One task per Kanban status
    for (const status of ALL_STATUSES) {
      const taskId = uuid();
      const needsReviewReason = STATUSES_NEEDING_REVIEW_REASON.includes(status);
      const isPrCreated = status === 'pr_created';

      await db.execute({
        sql: `INSERT INTO tasks
              (id, product_id, title, description, status, review_reason,
               github_issue_number, github_issue_url, github_repo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          taskId,
          productId,
          faker.lorem.sentence(),
          faker.lorem.paragraph(),
          status,
          needsReviewReason ? 'Needs review' : null,
          isPrCreated ? 1 : null,
          isPrCreated ? `https://github.com/${owner}/${repo}/issues/1` : null,
          isPrCreated ? `${owner}/${repo}` : null,
        ],
      });
    }
    console.log(`[seed] Created 8 tasks for product: ${repo}`);

    // 3 issue_triage records per product: 1 triaged with priority, 2 untriaged
    const triagedRecords = [
      { number: 1, isTriaged: 1, priority: 'high' },
      { number: 2, isTriaged: 0, priority: null },
      { number: 3, isTriaged: 0, priority: null },
    ];
    for (const { number, isTriaged, priority } of triagedRecords) {
      await db.execute({
        sql: `INSERT INTO issue_triage (github_repo, github_issue_number, is_triaged, priority)
              VALUES (?, ?, ?, ?)`,
        args: [`${owner}/${repo}`, number, isTriaged, priority],
      });
    }
    console.log(`[seed] Created 3 issue_triage records for: ${owner}/${repo}`);
  }

  console.log('[seed] Done. Run npm run dev to start the dev server.');
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
