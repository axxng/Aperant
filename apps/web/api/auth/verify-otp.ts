import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../_lib/db/client.js';
import { verifyOtp } from '../_lib/auth/otp.js';
import { createToken } from '../_lib/auth/jwt.js';
import { getUserByEmail } from '../_lib/db/users.js';

const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, code } = parsed.data;
  const valid = await verifyOtp(email, code);

  if (!valid) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  const token = createToken(user.id, user.email, user.role);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}
