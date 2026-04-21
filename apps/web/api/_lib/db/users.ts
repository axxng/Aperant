import { v4 as uuid } from 'uuid';
import { getClient } from './client.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: string;
  github_token: string | null;
  github_login: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email],
  });
  return result.rows[0] as unknown as UserRow | undefined;
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  const result = await getClient().execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return result.rows[0] as unknown as UserRow | undefined;
}

export async function createUser(id: string, email: string, name: string, passwordHash: string, role = 'member'): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    args: [id, email, name, passwordHash, role],
  });
}

export async function createUserWithoutPassword(id: string, email: string, name: string, role = 'member'): Promise<void> {
  await getClient().execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [id, email, name, role],
  });
}

export async function listUsers(): Promise<UserRow[]> {
  const result = await getClient().execute(
    'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  return result.rows as unknown as UserRow[];
}

export async function updateUser(id: string, updates: { name?: string; role?: string }): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.role !== undefined) { sets.push('role = ?'); values.push(updates.role); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  await getClient().execute({
    sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
    args: values,
  });
}

export async function deleteUser(id: string): Promise<void> {
  await getClient().execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [id],
  });
}

export async function userCount(): Promise<number> {
  const result = await getClient().execute('SELECT COUNT(*) as count FROM users');
  return Number(result.rows[0]?.count ?? 0);
}

export async function upsertOAuthUser(params: {
  githubId: string;
  email: string;
  name: string;
  githubLogin: string;
  githubToken: string;
  role: string;
}): Promise<UserRow> {
  const id = uuid();
  await getClient().execute({
    sql: `INSERT INTO users (id, email, name, github_login, github_token, role)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            github_login = excluded.github_login,
            github_token = excluded.github_token,
            name = CASE WHEN users.name = '' THEN excluded.name ELSE users.name END,
            updated_at = datetime('now')`,
    args: [id, params.email, params.name, params.githubLogin, params.githubToken, params.role],
  });
  const user = await getUserByEmail(params.email);
  return user!;
}
