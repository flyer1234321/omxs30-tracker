import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('APP_SESSION_SECRET is required for alert unsubscribe links.');
  return value;
}

function sign(userId: string) {
  return createHmac('sha256', secret()).update(`alert-unsubscribe:${userId}`).digest('base64url');
}

export function createUnsubscribeToken(userId: string) {
  return sign(userId);
}

export function hasValidUnsubscribeToken(userId: string, token: string | null) {
  if (!token) return false;
  const expected = Buffer.from(sign(userId));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
