import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from './jwt.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export async function authenticateRequest(req: VercelRequest, res: VercelResponse): Promise<TokenPayload | null> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  return payload as TokenPayload;
}

export function hasRole(user: TokenPayload, ...roles: string[]): boolean {
  return roles.includes(user.role);
}
