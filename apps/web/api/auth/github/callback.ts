import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../../_lib/db/client.js';
import { createToken } from '../../_lib/auth/jwt.js';
import { upsertOAuthUser, userCount } from '../../_lib/db/users.js';
import { oauthTokenResponseSchema, gitHubUserSchema } from '../../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Parse input — CSRF check is input validation (pure function)
  if (!validateOAuthState(req.headers.cookie || '', req.query.state as string | undefined)) {
    return res.status(400).json({ error: 'Invalid OAuth state' });
  }
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).json({ error: 'Missing OAuth code' });

  // 2. Authorize — N/A for OAuth callback (it's the auth entry point)

  try {
    await ensureDb();

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.OAUTH_CALLBACK_URL,
      }),
    });
    const tokenData = oauthTokenResponseSchema.parse(await tokenResponse.json());
    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({ error: 'OAuth token exchange failed' });
    }

    // Fetch GitHub user info with the new token
    const githubUser = gitHubUserSchema.parse(
      await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }).then((r) => r.json())
    );

    // I/O: get user count
    const count = await userCount();

    // 3. Pure domain function(s)
    const userRecord = buildUserRecord(githubUser, tokenData, count);

    // I/O: upsert — ON CONFLICT(email) DO UPDATE preserves existing role (per RESEARCH.md Pitfall 6)
    const user = await upsertOAuthUser(userRecord);

    // Issue JWT using existing createToken (userId, email, role) — structure unchanged
    const jwt = createToken(user.id, user.email, user.role);

    // 4. Respond — clear state cookie and redirect with JWT
    const securePart = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `oauth_state=; HttpOnly${securePart}; Max-Age=0; Path=/`);
    res.redirect(302, `/?token=${jwt}`);
  } catch (error: unknown) {
    console.error('[oauth callback]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// === Pure domain logic ===
// Functions below this line: no I/O, no fetch, no DB calls, deterministic

export function validateOAuthState(cookieHeader: string, queryState: string | undefined): boolean {
  const cookieState = cookieHeader
    .split('; ')
    .find((c) => c.startsWith('oauth_state='))
    ?.split('=')[1];
  return !!(cookieState && queryState && cookieState === queryState);
}

export function determineRole(userCount: number): 'admin' | 'member' {
  return userCount === 0 ? 'admin' : 'member';
}

export function buildEmailFallback(email: string | null | undefined, login: string): string {
  return email || `${login}@github.invalid`;
}

export function buildUserRecord(
  githubUser: z.infer<typeof gitHubUserSchema>,
  tokenData: z.infer<typeof oauthTokenResponseSchema>,
  count: number
): {
  githubId: string;
  email: string;
  name: string;
  githubLogin: string;
  githubToken: string;
  role: string;
} {
  return {
    githubId: String(githubUser.id),
    email: buildEmailFallback(githubUser.email, githubUser.login),
    name: githubUser.name || githubUser.login,
    githubLogin: githubUser.login,
    githubToken: tokenData.access_token,
    role: determineRole(count),
  };
}
