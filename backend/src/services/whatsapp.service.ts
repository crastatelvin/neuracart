import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * WhatsApp Cloud API — env-gated. Without WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
 * this logs the payload and returns; email remains the delivery channel.
 */

const API_ROOT = 'https://graph.facebook.com/v20.0';

export function whatsappConfigured(): boolean {
  return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);
}

export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<void> {
  if (!whatsappConfigured()) {
    logger.info('WhatsApp suppressed (not configured)', { to, body });
    return;
  }
  try {
    const response = await fetch(
      `${API_ROOT}/${env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn('WhatsApp send failed', {
        to,
        status: response.status,
        body: text.slice(0, 200),
      });
    }
  } catch (error) {
    logger.warn('WhatsApp send failed', {
      to,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
