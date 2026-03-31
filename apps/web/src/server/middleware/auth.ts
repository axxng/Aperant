import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt.js';

/**
 * Express middleware that verifies JWT Bearer tokens.
 * Attaches decoded payload to req.user on success.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Accept token from Authorization header or query parameter (for SSE/EventSource)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user info to request for downstream handlers
  (req as any).user = payload;
  next();
}

/**
 * Express middleware that requires the authenticated user to have the 'admin' role.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
