import { getDb } from './schema.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function createUser(id: string, email: string, name: string, passwordHash: string, role = 'member'): void {
  getDb().prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email, name, passwordHash, role);
}

export function listUsers(): UserRow[] {
  return getDb().prepare('SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC').all() as UserRow[];
}

export function updateUser(id: string, updates: { name?: string; role?: string }): void {
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.role !== undefined) { sets.push('role = ?'); values.push(updates.role); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteUser(id: string): void {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function createUserWithoutPassword(id: string, email: string, name: string, role = 'member'): void {
  getDb().prepare(
    'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
  ).run(id, email, name, role);
}

export function userCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}
