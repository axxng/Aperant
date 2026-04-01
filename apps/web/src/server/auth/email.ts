import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.OTP_FROM_EMAIL || 'Aperant <onboarding@resend.dev>';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!resendApiKey) return null;
  if (!resend) resend = new Resend(resendApiKey);
  return resend;
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const client = getResend();

  if (!client) {
    // Development fallback: log to console
    console.log(`[OTP] Code for ${email}: ${code}`);
    return;
  }

  await client.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your Aperant login code',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="margin-bottom: 8px;">Your login code</h2>
        <p style="color: #666; margin-bottom: 24px;">Enter this code to sign in to Aperant.</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
          ${code}
        </div>
        <p style="color: #999; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
