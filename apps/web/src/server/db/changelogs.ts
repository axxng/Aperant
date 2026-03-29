import { getDb } from './schema.js';

export function getChangelogs(productId: string) {
  return getDb().prepare('SELECT * FROM changelogs WHERE product_id = ? ORDER BY updated_at DESC').all(productId) as any[];
}

export function getChangelogById(id: string) {
  return getDb().prepare('SELECT * FROM changelogs WHERE id = ?').get(id) as any | undefined;
}

export function createChangelog(id: string, productId: string, content: string, config: string) {
  getDb().prepare(
    'INSERT INTO changelogs (id, product_id, content, config) VALUES (?, ?, ?, ?)'
  ).run(id, productId, content, config);
}

export function updateChangelog(id: string, content: string) {
  getDb().prepare(
    "UPDATE changelogs SET content = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(content, id);
}

export function deleteChangelog(id: string) {
  getDb().prepare('DELETE FROM changelogs WHERE id = ?').run(id);
}
