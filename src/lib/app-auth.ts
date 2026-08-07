import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'omx30_session';
const SESSION_DURATION_SECONDS = 12 * 60 * 60;
const password = process.env.APP_ACCESS_PASSWORD;
const sessionSecret = process.env.APP_SESSION_SECRET;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseKey);
export const isPasswordAuthConfigured = Boolean(password && password.length >= 12 && sessionSecret && sessionSecret.length >= 32);
export const isAuthConfigured = isSupabaseAuthConfigured || isPasswordAuthConfigured;

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  provider: 'supabase' | 'password';
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret!).update(value).digest('base64url');
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
}

export function getClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function passwordMatches(candidate: string) {
  if (!isPasswordAuthConfigured) return false;
  const expected = Buffer.from(password!);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function hasValidSession(request: Request) {
  if (!isPasswordAuthConfigured) return false;
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = Buffer.from(sign(encodedPayload));
  const receivedSignature = Buffer.from(signature);
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) return false;

  try {
    const [expiresAt] = Buffer.from(encodedPayload, 'base64url').toString('utf8').split('.');
    return Number(expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function sessionCookie(request: Request) {
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  const payload = Buffer.from(`${expiresAt}.${randomBytes(18).toString('base64url')}`).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${isSecureRequest(request) ? '; Secure' : ''}`;
}

export function expiredSessionCookie(request: Request) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecureRequest(request) ? '; Secure' : ''}`;
}

function allowedEmails() {
  return (process.env.APP_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function getSupabaseUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !supabaseUrl || !supabaseKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string; email?: string | null };
    if (!user.id) return null;
    const email = user.email?.toLowerCase() || null;
    const allowlist = allowedEmails();
    if (allowlist.length > 0 && (!email || !allowlist.includes(email))) return null;
    return { id: user.id, email, provider: 'supabase' };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  if (isSupabaseAuthConfigured) return getSupabaseUser(request);
  if (!hasValidSession(request)) return null;
  return { id: 'password-user', email: null, provider: 'password' };
}

export async function requireAuthenticatedUser(request: Request) {
  if (!isAuthConfigured) return Response.json({ error: 'Authentication is not configured' }, { status: 503 });
  if (!await getAuthenticatedUser(request)) return Response.json({ error: 'Authentication required' }, { status: 401 });
  return null;
}
