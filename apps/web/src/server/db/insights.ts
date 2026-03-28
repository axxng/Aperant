import { getDb } from './schema.js';
import { v4 as uuid } from 'uuid';

export interface DBInsightsSession {
  id: string;
  title: string | null;
  messages: string; // JSON string
  model_config: string; // JSON string
  created_at: string;
  updated_at: string;
}

export function listSessions(): DBInsightsSession[] {
  return getDb()
    .prepare('SELECT id, title, model_config, created_at, updated_at, messages FROM insights_sessions ORDER BY updated_at DESC')
    .all() as DBInsightsSession[];
}

export function getSession(id: string): DBInsightsSession | undefined {
  return getDb()
    .prepare('SELECT * FROM insights_sessions WHERE id = ?')
    .get(id) as DBInsightsSession | undefined;
}

export function createSession(title?: string): DBInsightsSession {
  const id = uuid();
  const now = new Date().toISOString();
  getDb()
    .prepare('INSERT INTO insights_sessions (id, title, messages, model_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, title ?? null, '[]', '{}', now, now);
  return getSession(id)!;
}

export function updateSession(id: string, updates: { title?: string; messages?: string; model_config?: string }): void {
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const vals: any[] = [];
  if (updates.title !== undefined) { sets.push('title = ?'); vals.push(updates.title); }
  if (updates.messages !== undefined) { sets.push('messages = ?'); vals.push(updates.messages); }
  if (updates.model_config !== undefined) { sets.push('model_config = ?'); vals.push(updates.model_config); }
  vals.push(id);
  getDb().prepare(`UPDATE insights_sessions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM insights_sessions WHERE id = ?').run(id);
}
