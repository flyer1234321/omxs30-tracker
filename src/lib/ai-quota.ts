import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface AiQuotaResult {
  allowed: boolean;
  /** null betyder obegränsat. */
  remaining: number | null;
  used: number;
  /** 0 betyder obegränsat. */
  dailyLimit: number;
  /** false betyder att kvoten inte kunde lasas eller reserveras. */
  available: boolean;
}

export function aiQuotaFromUsage(dailyLimit: number, requestCount: number): AiQuotaResult {
  const normalizedLimit = Math.max(0, Math.floor(dailyLimit));
  const used = Math.max(0, Math.floor(requestCount));
  if (normalizedLimit === 0) {
    return { allowed: true, remaining: null, used, dailyLimit: 0, available: true };
  }
  const remaining = Math.max(0, normalizedLimit - used);
  return { allowed: remaining > 0, remaining, used, dailyLimit: normalizedLimit, available: true };
}

function stockholmDate() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Laser dagens anvandning utan att reservera ett nytt betalt anrop. */
export async function getAiQuotaStatus(email: string | null, dailyLimit: number): Promise<AiQuotaResult> {
  if (dailyLimit <= 0) return aiQuotaFromUsage(0, 0);
  if (!email || !process.env.SUPABASE_SECRET_KEY) {
    console.error('A finite AI quota requires a Supabase user and SUPABASE_SECRET_KEY.');
    return { ...aiQuotaFromUsage(dailyLimit, dailyLimit), available: false };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('ai_request_usage')
      .select('request_count')
      .eq('email', email.trim().toLowerCase())
      .eq('usage_date', stockholmDate())
      .maybeSingle();
    if (error) throw error;

    return aiQuotaFromUsage(dailyLimit, Number(data?.request_count ?? 0));
  } catch (error) {
    console.error('Could not read AI request quota:', error);
    return { ...aiQuotaFromUsage(dailyLimit, dailyLimit), available: false };
  }
}

/**
 * Reserverar ett betalt AI-anrop atomiskt i Supabase. Funktionen anropas först
 * efter cachekontrollen, så samma aktuella analys debiteras inte flera gånger.
 */
export async function claimAiRequest(email: string | null, dailyLimit: number): Promise<AiQuotaResult> {
  if (dailyLimit <= 0) return aiQuotaFromUsage(0, 0);
  if (!email || !process.env.SUPABASE_SECRET_KEY) {
    console.error('A finite AI quota requires a Supabase user and SUPABASE_SECRET_KEY.');
    return { ...aiQuotaFromUsage(dailyLimit, dailyLimit), available: false };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('claim_ai_request', {
      p_email: email,
      p_daily_limit: dailyLimit,
    });
    if (error) throw error;

    const remaining = Number(data);
    if (!Number.isFinite(remaining)) throw new Error('Invalid AI quota response.');
    if (remaining < 0) return aiQuotaFromUsage(dailyLimit, dailyLimit);
    // RPC-svaret 0 betyder att det sista tillatna anropet just reserverades.
    // Det aktuella anropet ska da fortfarande fa ga igenom, aven om nasta
    // anrop ska nekas.
    return { ...aiQuotaFromUsage(dailyLimit, dailyLimit - remaining), allowed: true };
  } catch (error) {
    // En konfigurerad gräns får inte kunna kringgås för att migrationen saknas.
    console.error('Could not claim AI request quota:', error);
    return { ...aiQuotaFromUsage(dailyLimit, dailyLimit), available: false };
  }
}
