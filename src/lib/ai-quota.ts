import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface AiQuotaResult {
  allowed: boolean;
  /** null betyder obegränsat. */
  remaining: number | null;
}

/**
 * Reserverar ett betalt AI-anrop atomiskt i Supabase. Funktionen anropas först
 * efter cachekontrollen, så samma aktuella analys debiteras inte flera gånger.
 */
export async function claimAiRequest(email: string | null, dailyLimit: number): Promise<AiQuotaResult> {
  if (dailyLimit <= 0) return { allowed: true, remaining: null };
  if (!email || !process.env.SUPABASE_SECRET_KEY) {
    console.error('A finite AI quota requires a Supabase user and SUPABASE_SECRET_KEY.');
    return { allowed: false, remaining: 0 };
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
    return { allowed: remaining >= 0, remaining: Math.max(0, remaining) };
  } catch (error) {
    // En konfigurerad gräns får inte kunna kringgås för att migrationen saknas.
    console.error('Could not claim AI request quota:', error);
    return { allowed: false, remaining: 0 };
  }
}
