import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { ensureDb } from '../_lib/db/client.js';
import { generateOtp, storeOtp } from '../_lib/auth/otp.js';
import { sendOtpEmail } from '../_lib/auth/email.js';
import { getUserByEmail } from '../_lib/db/users.js';

const requestOtpSchema = z.object({
  email: z.string().email(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureDb();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const { email } = parsed.data;
  const user = await getUserByEmail(email);

  // Always return success to avoid leaking whether email is whitelisted
  if (!user) {
    return res.json({ message: 'If your email is registered, you will receive a code.' });
  }

  try {
    const { code, hash } = generateOtp();
    await storeOtp(email, hash);
    await sendOtpEmail(email, code);
  } catch (error: any) {
    if (error.message === 'Too many OTP requests') {
      return res.status(429).json({ error: 'Too many requests, try again later' });
    }
    // Log but don't expose internal errors
    console.error('[OTP] Failed to send:', error.message);
  }

  res.json({ message: 'If your email is registered, you will receive a code.' });
}
