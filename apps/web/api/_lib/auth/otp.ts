import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { getClient } from '../db/client.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_RATE_LIMIT = 5; // max per email per 15 minutes

export function generateOtp(): { code: string; hash: string } {
  const code = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

export async function storeOtp(email: string, codeHash: string): Promise<string> {
  const c = getClient();
  const id = uuid();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString().replace('T', ' ').replace('Z', '');

  // Clean up expired OTPs for this email
  await c.execute({
    sql: "DELETE FROM otp_codes WHERE email = ? AND (used = 1 OR expires_at < datetime('now'))",
    args: [email],
  });

  // Rate limit check
  const rateResult = await c.execute({
    sql: "SELECT COUNT(*) as count FROM otp_codes WHERE email = ? AND created_at > datetime('now', '-15 minutes')",
    args: [email],
  });
  const recentCount = Number(rateResult.rows[0]?.count ?? 0);

  if (recentCount >= OTP_RATE_LIMIT) {
    throw new Error('Too many OTP requests');
  }

  await c.execute({
    sql: 'INSERT INTO otp_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [id, email, codeHash, expiresAt],
  });

  return id;
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const c = getClient();
  const hash = crypto.createHash('sha256').update(code).digest('hex');

  // Find valid OTP
  const findResult = await c.execute({
    sql: "SELECT id FROM otp_codes WHERE email = ? AND code_hash = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
    args: [email, hash],
  });

  const row = findResult.rows[0];
  if (!row) return false;

  // Mark as used
  await c.execute({
    sql: 'UPDATE otp_codes SET used = 1 WHERE id = ?',
    args: [row.id as string],
  });

  return true;
}
