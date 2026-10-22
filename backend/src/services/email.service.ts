import { Resend } from 'resend';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!resend) {
    if (env.isProd) {
      throw new AppError(
        'Email service is not configured',
        502,
        'EMAIL_NOT_CONFIGURED',
      );
    }
    logger.warn('Email suppressed in development', {
      to: payload.to,
      subject: payload.subject,
    });
    return;
  }

  const { error } = await resend.emails.send({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (error) {
    logger.error('Resend rejected an email', {
      to: payload.to,
      subject: payload.subject,
      error: new Error(error.message),
    });
    throw new AppError('Could not send email', 502, 'EMAIL_SEND_FAILED');
  }
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const minutes = env.OTP_EXPIRES_IN_MINUTES;
  await sendEmail({
    to: email,
    subject: 'Your LocalMart login code',
    text: `Your LocalMart login code is ${code}. It expires in ${minutes} minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14532d">
        <h1 style="font-size:24px;margin:0 0 8px">LocalMart</h1>
        <p style="color:#4b5563;margin:0 0 24px">Your neighbourhood market, delivered.</p>
        <p>Use this code to sign in:</p>
        <p style="font-size:36px;letter-spacing:8px;font-weight:700;background:#dcfce7;padding:16px;text-align:center;border-radius:12px">${code}</p>
        <p style="color:#4b5563">This code expires in ${minutes} minutes.</p>
        <p style="color:#6b7280;font-size:13px">If you did not request this code, you can safely ignore this email.</p>
        <p style="color:#6b7280;font-size:13px">Need help? ${env.SUPPORT_EMAIL}</p>
      </div>
    `,
  });
}
