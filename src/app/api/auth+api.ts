import {
  expiredSessionCookie,
  getClientKey,
  hasValidSession,
  isAuthConfigured,
  passwordMatches,
  sessionCookie,
} from '@/lib/app-auth';
import { loginRateLimiter } from '@/lib/login-rate-limit';

export async function GET(request: Request) {
  return Response.json({ configured: isAuthConfigured, authenticated: hasValidSession(request) });
}

export async function POST(request: Request) {
  if (!isAuthConfigured) return Response.json({ error: 'Authentication is not configured' }, { status: 503 });

  const clientKey = getClientKey(request);
  const limit = loginRateLimiter.check(clientKey);
  if (!limit.allowed) {
    return Response.json({ error: 'För många försök. Försök igen senare.', retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
  }

  let accessPassword = '';
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && 'password' in body && typeof body.password === 'string') accessPassword = body.password;
  } catch {}

  if (!passwordMatches(accessPassword)) {
    const nextLimit = loginRateLimiter.recordFailure(clientKey);
    const status = nextLimit.allowed ? 401 : 429;
    return Response.json(
      { error: nextLimit.allowed ? 'Fel lösenord.' : 'För många försök. Försök igen senare.', retryAfterSeconds: nextLimit.allowed ? undefined : nextLimit.retryAfterSeconds },
      { status },
    );
  }

  loginRateLimiter.reset(clientKey);
  return Response.json({ authenticated: true }, { headers: { 'Set-Cookie': sessionCookie(request) } });
}

export async function DELETE(request: Request) {
  return Response.json({ authenticated: false }, { headers: { 'Set-Cookie': expiredSessionCookie(request) } });
}
