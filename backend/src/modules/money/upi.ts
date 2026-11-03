import { env } from '../../config/env';

/**
 * UPI intent flow — an honest hand-off model. We build the standard
 * `upi://pay` deep link; the customer pays in their UPI app and acknowledges
 * with the last 4 of the UTR. An admin verifies it (or Razorpay automates it
 * when test keys are configured — see payments.ts next phase).
 */
export function buildUpiIntent(params: {
  orderNumber: string;
  amount: string | number;
}): string {
  const query = new URLSearchParams({
    pa: env.UPI_VPA,
    pn: env.UPI_PAYEE_NAME,
    am: Number(params.amount).toFixed(2),
    cu: 'INR',
    tn: `NeuraCart ${params.orderNumber}`,
  });
  return `upi://pay?${query.toString()}`;
}

export type UpiAck = {
  paymentRef: string;
  txnNote: string;
};

/** Store the customer's "I've paid" claim as a UPI-ack payment reference. */
export function makeUpiAck(_orderNumber: string, utrLast4: string): UpiAck {
  const last4 = utrLast4.replace(/\D/g, '').slice(-4) || '0000';
  return {
    paymentRef: `upi-acked:${last4}:${new Date().toISOString()}`,
    txnNote: `UPI payment claim (${last4}) — awaiting admin verification`,
  };
}
