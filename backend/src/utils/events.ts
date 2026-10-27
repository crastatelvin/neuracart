import { EventEmitter } from 'node:events';

/**
 * Tiny in-process pub/sub powering the SSE `/api/updates` stream and
 * internal feature hooks. Channels:
 *  - `user:<userId>` — customer-visible events (their orders, wallet, AI…)
 *  - `rider:<userId>` — delivery-partner events (assignments, weather)
 *  - `admin` — back-office events (new order, declines, UPI verifications…)
 *  - `broadcast` — everyone (store status, weather mode)
 */
export type RealtimeEvent = {
  type: string;
  at: string;
  data: Record<string, unknown>;
};

const emitter = new EventEmitter();
// Every stream listener is long-lived; raise the default cap.
emitter.setMaxListeners(200);

export function subscribe(
  channels: string[],
  listener: (event: RealtimeEvent) => void,
): () => void {
  for (const channel of channels) emitter.on(channel, listener);
  return () => {
    for (const channel of channels) emitter.off(channel, listener);
  };
}

export function publish(
  channel: string,
  type: string,
  data: Record<string, unknown> = {},
): void {
  emitter.emit(channel, {
    type,
    at: new Date().toISOString(),
    data,
  } satisfies RealtimeEvent);
}

/** Channels a connected client of the given role should listen to. */
export function channelsForRole(role: string, userId: string): string[] {
  if (role === 'ADMIN') return ['admin', 'broadcast'];
  if (role === 'DELIVERY_PARTNER') return [`rider:${userId}`, 'broadcast'];
  return [`user:${userId}`, 'broadcast'];
}
