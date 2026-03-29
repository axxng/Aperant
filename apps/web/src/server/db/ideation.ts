import { getDb } from './schema.js';

export function getIdeationSession(productId: string) {
  return getDb().prepare('SELECT * FROM ideation_sessions WHERE product_id = ? ORDER BY updated_at DESC LIMIT 1').get(productId) as any | undefined;
}

export function createIdeationSession(id: string, productId: string, ideas: string, config: string) {
  getDb().prepare(
    'INSERT INTO ideation_sessions (id, product_id, ideas, config) VALUES (?, ?, ?, ?)'
  ).run(id, productId, ideas, config);
}

export function updateIdeationSession(id: string, ideas: string) {
  getDb().prepare(
    "UPDATE ideation_sessions SET ideas = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(ideas, id);
}

export function deleteIdeationSession(id: string) {
  getDb().prepare('DELETE FROM ideation_sessions WHERE id = ?').run(id);
}
