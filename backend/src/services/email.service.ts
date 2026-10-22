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

export type OrderEmailStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

const ORDER_EMAIL_COPY: Record<
  OrderEmailStatus,
  { subject: string; heading: string; body: string }
> = {
  PENDING: {
    subject: 'Order placed',
    heading: 'We received your order',
    body: 'The store will confirm it shortly.',
  },
  CONFIRMED: {
    subject: 'Order confirmed',
    heading: 'Your order is confirmed',
    body: 'We are getting your items ready.',
  },
  PREPARING: {
    subject: 'Order is being packed',
    heading: 'Your order is being packed',
    body: 'We will hand it to a rider soon.',
  },
  ASSIGNED: {
    subject: 'Rider assigned',
    heading: 'A rider is assigned',
    body: 'Your order will be picked up shortly.',
  },
  OUT_FOR_DELIVERY: {
    subject: 'Out for delivery',
    heading: 'Your order is on the way',
    body: 'The rider is heading to your address.',
  },
  DELIVERED: {
    subject: 'Order delivered',
    heading: 'Delivered — enjoy!',
    body: 'Thanks for shopping with LocalMart.',
  },
  CANCELLED: {
    subject: 'Order cancelled',
    heading: 'Your order was cancelled',
    body: 'If you paid online, a refund will follow shortly.',
  },
};

export async function sendOrderStatusEmail(input: {
  to: string;
  orderNumber: string;
  status: OrderEmailStatus;
  total: string;
}): Promise<void> {
  const copy = ORDER_EMAIL_COPY[input.status];
  const text = `${copy.heading}

Order ${input.orderNumber}
Total: INR ${input.total}

${copy.body}

Need help? ${env.SUPPORT_EMAIL}`;
  await sendEmail({
    to: input.to,
    subject: `LocalMart ${input.orderNumber}: ${copy.subject}`,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14532d">
        <h1 style="font-size:24px;margin:0 0 8px">${copy.heading}</h1>
        <p style="color:#4b5563">Order <strong>${input.orderNumber}</strong></p>
        <p style="font-size:20px;font-weight:700">INR ${input.total}</p>
        <p>${copy.body}</p>
        <p style="color:#6b7280;font-size:13px">Need help? ${env.SUPPORT_EMAIL}</p>
      </div>
    `,
  });
}

export async function sendRiderDeclinedEmail(input: {
  to: string;
  orderNumber: string;
  riderName: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `LocalMart ${input.orderNumber}: rider declined`,
    text: `Rider ${input.riderName} declined order ${input.orderNumber}. The order is back in the preparing queue and needs another rider.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14532d">
        <h1 style="font-size:24px;margin:0 0 8px">Rider declined an assignment</h1>
        <p>Order <strong>${input.orderNumber}</strong> needs another rider.</p>
        <p>${input.riderName} declined the assignment. The order is back in the preparing queue.</p>
        <p style="color:#6b7280;font-size:13px">Open the LocalMart admin panel to reassign it.</p>
      </div>
    `,
  });
}

export async function sendDeliveryPartnerWelcomeEmail(input: {
  to: string;
  name: string;
  password: string;
}): Promise<void> {
  const isProduction = env.NODE_ENV === 'production';
  const credentials = isProduction
    ? 'Sign in with the delivery partner app using this email address. Ask your manager for access if you cannot sign in.'
    : `Your temporary password is: ${input.password}`;
  await sendEmail({
    to: input.to,
    subject: 'Welcome to LocalMart Delivery',
    text: `Hi ${input.name},\n\nYour LocalMart Delivery partner account is ready.\n\n${credentials}\n\nSupport: ${env.SUPPORT_EMAIL}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14532d">
        <h1 style="font-size:24px;margin:0 0 8px">Welcome to LocalMart Delivery</h1>
        <p>Hi ${input.name},</p>
        <p>Your delivery partner account is ready.</p>
        <p style="background:#f0fdf4;padding:16px;border-radius:12px">${credentials}</p>
        <p style="color:#6b7280;font-size:13px">Need help? ${env.SUPPORT_EMAIL}</p>
      </div>
    `,
  });
}
