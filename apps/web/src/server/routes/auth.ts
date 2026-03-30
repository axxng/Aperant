import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getUserByEmail, getUserById, createUser, listUsers, updateUser, deleteUser } from '../db/users.js';
import { createToken, verifyToken, hashPassword, verifyPassword } from '../auth/jwt.js';

export const authRoutes = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/** POST /register — Create account */
authRoutes.post('/register', (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, name, password } = parsed.data;

  if (getUserByEmail(email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = uuid();
  const passwordHash = hashPassword(password);
  // First user is admin
  const users = listUsers();
  const role = users.length === 0 ? 'admin' : 'member';

  createUser(id, email, name, passwordHash, role);
  const token = createToken(id, email, role);

  res.status(201).json({ token, user: { id, email, name, role } });
});

/** POST /login — Authenticate */
authRoutes.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  const { email, password } = parsed.data;

  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = createToken(user.id, user.email, user.role);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

/** GET /me — Get current user (requires auth header) */
authRoutes.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = getUserById(payload.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

/** GET /users — List all users (admin only) */
authRoutes.get('/users', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const users = listUsers();
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at })));
});

/** PATCH /users/:id — Update user role (admin only) */
authRoutes.patch('/users/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const updateSchema = z.object({ name: z.string().optional(), role: z.enum(['admin', 'member', 'viewer']).optional() });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  updateUser(req.params.id, parsed.data);
  res.json({ success: true });
});

/** DELETE /users/:id — Delete user (admin only) */
authRoutes.delete('/users/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const payload = verifyToken(authHeader.slice(7));
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (payload.userId === req.params.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  deleteUser(req.params.id);
  res.json({ success: true });
});
