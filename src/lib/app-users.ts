import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Behörigheter låg tidigare i miljövariabeln APP_ALLOWED_EMAILS, vilket innebar
 * att varje ny användare krävde en ny deploy. De ligger nu i tabellen
 * app_users, som administratören kan redigera från appen.
 *
 * Tre saker gör upplösningen mer invecklad än en enkel databasfråga, och alla
 * tre handlar om att inte kunna låsa ut sig själv:
 *
 * 1. APP_ADMIN_EMAILS gäller alltid, oavsett vad som står i tabellen. Utan den
 *    utvägen skulle en felaktig rad kunna spärra den sista administratören.
 * 2. Är tabellen tom används den gamla miljövariabeln. Det gör att en
 *    befintlig installation fortsätter fungera tills den första användaren
 *    lagts in.
 * 3. Svarar inte databasen faller allt tillbaka på miljövariablerna i stället
 *    för att neka. En nere-liggande Supabase ska inte stänga appen.
 */

export interface AppUserRecord {
  email: string;
  isAdmin: boolean;
  canUseAi: boolean;
  createdAt: string | null;
  disabledAt: string | null;
}

export interface AccessDecision {
  allowed: boolean;
  isAdmin: boolean;
  canUseAi: boolean;
  source: 'env-admin' | 'database' | 'env-fallback';
}

interface AppUserRow {
  email: string;
  is_admin: boolean;
  can_use_ai: boolean;
  created_at: string | null;
  disabled_at: string | null;
}

function emailList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function envAdminEmails() {
  return emailList(process.env.APP_ADMIN_EMAILS);
}

export function envAllowedEmails() {
  return emailList(process.env.APP_ALLOWED_EMAILS);
}

const CACHE_TTL = 60 * 1000;
let cache: { users: AppUserRecord[] | null; cachedAt: number } | null = null;

function toRecord(row: AppUserRow): AppUserRecord {
  return {
    email: row.email,
    isAdmin: Boolean(row.is_admin),
    canUseAi: Boolean(row.can_use_ai),
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
  };
}

/** Returnerar null när tabellen inte går att läsa, vilket är skilt från tom lista. */
export async function loadAppUsers(force = false): Promise<AppUserRecord[] | null> {
  if (!force && cache && Date.now() - cache.cachedAt < CACHE_TTL) return cache.users;
  if (!process.env.SUPABASE_SECRET_KEY) {
    cache = { users: null, cachedAt: Date.now() };
    return null;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('app_users')
      .select('email, is_admin, can_use_ai, created_at, disabled_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const users = (data as AppUserRow[]).map(toRecord);
    cache = { users, cachedAt: Date.now() };
    return users;
  } catch (error) {
    console.error('Could not read app_users:', error);
    cache = { users: null, cachedAt: Date.now() };
    return null;
  }
}

export function invalidateAppUserCache() {
  cache = null;
}

/**
 * Själva beslutet, utan databasanrop, så att det går att testa uttömmande.
 * `users` är null när tabellen inte kunde läsas, vilket är något annat än att
 * den är tom.
 */
export function decideAccess(
  email: string | null,
  users: AppUserRecord[] | null,
  envAdmins: string[],
  envAllowlist: string[],
): AccessDecision {
  const normalized = email?.trim().toLowerCase() || null;

  if (normalized && envAdmins.includes(normalized)) {
    return { allowed: true, isAdmin: true, canUseAi: true, source: 'env-admin' };
  }

  if (users && users.length > 0) {
    const record = normalized ? users.find((user) => user.email === normalized) : undefined;
    if (!record || record.disabledAt) {
      return { allowed: false, isAdmin: false, canUseAi: false, source: 'database' };
    }
    return { allowed: true, isAdmin: record.isAdmin, canUseAi: record.canUseAi, source: 'database' };
  }

  // Tabellen är tom eller oläsbar: fall tillbaka på miljövariablerna.
  const allowed = envAllowlist.length === 0 || Boolean(normalized && envAllowlist.includes(normalized));
  return {
    allowed,
    isAdmin: false,
    // Innan behörigheterna flyttats till databasen hade alla tillgång till
    // AI-analysen. Beteendet behålls så att en uppgradering inte tar bort
    // funktioner för befintliga användare.
    canUseAi: allowed,
    source: 'env-fallback',
  };
}

export async function resolveAccess(email: string | null): Promise<AccessDecision> {
  return decideAccess(email, await loadAppUsers(), envAdminEmails(), envAllowedEmails());
}
