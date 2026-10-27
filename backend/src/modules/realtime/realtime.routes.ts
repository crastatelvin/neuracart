import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../../utils/jwt';
import { channelsForRole, subscribe } from '../../utils/events';

/**
 * `GET /api/updates?token=<accessToken>` — Server-Sent Events stream.
 *
 * EventSource cannot set headers, so the access token travels as a query
 * parameter. Tokens are short-lived (15 min) and verified with the same
 * rules as the Authorization header, so the exposure is minimal.
 */
export const streamUpdates: RequestHandler = (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required for the updates stream',
        code: 'TOKEN_REQUIRED',
      });
      return;
    }
    const payload = verifyAccessToken(token);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    res.write(
      `event: hello\ndata: ${JSON.stringify({
        type: 'connected',
        at: new Date().toISOString(),
        data: { userId: payload.userId, role: payload.role },
      })}\n\n`,
    );

    const channels = channelsForRole(payload.role, payload.userId);
    const write = (event: unknown): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = subscribe(channels, write);

    // Heartbeat keeps proxies from closing the idle connection.
    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25_000);

    const close = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    };
    req.on('close', close);
    res.on('error', close);
  } catch (error) {
    next(error);
  }
};

export type RealtimeQuery = { token: string };
