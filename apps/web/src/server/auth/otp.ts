import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/schema.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_RATE_LIMIT = 5; // max per email per 15 minutes

export function generateOtp(): { code: string; hash: string } {
  const code = crypto.randomInt(100000, 999999).toString();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

export function storeOtp(email: string, codeHash: string): string {
  const db = getDb();
  const id = uuid();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();

  // Clean up expired OTPs for this email
  db.prepare("DELETE FROM otp_codes WHERE email = ? AND (used = 1 OR expires_at < datetime('now'))").run(email);

  // Rate limit check
  const recentCount = db.prepare(
    "SELECT COUNT(*) as count FROM otp_codes WHERE email = ? AND created_at > datetime('now', '-15 minutes')"
  ).get(email) as { count: number };

  if (recentCount.count >= OTP_RATE_LIMIT) {
    throw new Error('Too many OTP requests');
  }

  db.prepare(
    'INSERT INTO otp_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(id, email, codeHash, expiresAt);

  return id;
}

export function verifyOtp(email: string, code: string): boolean {
  const db = getDb();
  const hash = crypto.createHash('sha256').update(code).digest('hex');

  const row = db.prepare(
    "SELECT id FROM otp_codes WHERE email = ? AND code_hash = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
  ).get(email, hash) as { id: string } | undefined;

  if (!row) return false;

  // Mark as used
  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
  return true;
}
