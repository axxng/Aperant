import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:5173/api/auth/github/callback';
const IS_PROD = process.env.NODE_ENV === 'production';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!GITHUB_CLIENT_ID) return res.status(500).json({ error: 'GitHub OAuth not configured' });

  const state = crypto.randomBytes(16).toString('hex');

  // CSRF protection: store state in HttpOnly cookie; read back in callback
  // SameSite=Lax (NOT Strict) — Strict blocks the cross-origin redirect from GitHub back to our callback
  const securePart = IS_PROD ? '; Secure' : '';
  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly${securePart}; SameSite=Lax; Max-Age=600; Path=/`);

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: 'read:user user:email',
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
