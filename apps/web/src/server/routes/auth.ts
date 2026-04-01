import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { getUserByEmail, getUserById, listUsers, updateUser, deleteUser, createUserWithoutPassword, userCount } from '../db/users.js';
import { createToken, verifyToken } from '../auth/jwt.js';
import { generateOtp, storeOtp, verifyOtp } from '../auth/otp.js';
import { sendOtpEmail } from '../auth/email.js';

export const authRoutes = Router();

const requestOtpSchema = z.object({
  email: z.string().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

/** POST /request-otp — Send OTP to whitelisted email */
authRoutes.post('/request-otp', async (req: Request, res: Response) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email' });
    return;
  }

  const { email } = parsed.data;
  const user = getUserByEmail(email);

  // Always return success to avoid leaking whether email is whitelisted
  if (!user) {
    res.json({ message: 'If your email is registered, you will receive a code.' });
    return;
  }

  try {
    const { code, hash } = generateOtp();
    storeOtp(email, hash);
    await sendOtpEmail(email, code);
  } catch (error: any) {
    if (error.message === 'Too many OTP requests') {
      res.status(429).json({ error: 'Too many requests, try again later' });
      return;
    }
    // Log but don't expose internal errors
    console.error('[OTP] Failed to send:', error.message);
  }

  res.json({ message: 'If your email is registered, you will receive a code.' });
});

/** POST /verify-otp — Verify OTP and return JWT */
authRoutes.post('/verify-otp', (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const { email, code } = parsed.data;
  const valid = verifyOtp(email, code);

  if (!valid) {
    res.status(401).json({ error: 'Invalid or expired code' });
    return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired code' });
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
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const users = listUsers();
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.created_at })));
});

/** POST /users — Add a whitelisted user (admin only) */
authRoutes.post('/users', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'member', 'viewer']).default('member'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  if (getUserByEmail(parsed.data.email)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = uuid();
  createUserWithoutPassword(id, parsed.data.email, parsed.data.name, parsed.data.role);
  res.status(201).json({ id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role });
});

/** PATCH /users/:id — Update user role (admin only) */
authRoutes.patch('/users/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const updateSchema = z.object({ name: z.string().optional(), role: z.enum(['admin', 'member', 'viewer']).optional() });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  updateUser(req.params.id as string, parsed.data);
  res.json({ success: true });
});

/** DELETE /users/:id — Delete user (admin only) */
authRoutes.delete('/users/:id', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const targetId = req.params.id as string;
  if (user.userId === targetId) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }

  deleteUser(targetId);
  res.json({ success: true });
});
