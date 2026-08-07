import { requireAdminUser } from '@/lib/app-auth';
import { isMarketOpen } from '@/lib/market-hours';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface AlertLogRow { status: string; created_at: string }

/**
 * Diagnostik för administratören. Endast booleaner: inga nyckelvärden lämnar
 * servern, bara beskedet om att de är satta eller inte. Syftet är att kunna se
 * varför något inte fungerar utan att behöva gå in i Vercels inställningar.
 */
export async function GET(request: Request) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  const configured = {
    magicLink: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)),
    passwordLogin: Boolean(process.env.APP_ACCESS_PASSWORD && process.env.APP_SESSION_SECRET),
    openAi: Boolean(process.env.OPENAI_API_KEY),
    supabaseServiceKey: Boolean(process.env.SUPABASE_SECRET_KEY),
    resend: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    cronSecret: Boolean(process.env.CRON_SECRET),
    appUrl: Boolean(process.env.APP_URL),
  };

  const access = {
    allowedEmails: (process.env.APP_ALLOWED_EMAILS || '').split(',').filter((value) => value.trim()).length,
    adminEmails: (process.env.APP_ADMIN_EMAILS || '').split(',').filter((value) => value.trim()).length,
  };

  const markets = {
    stockholmOpen: isMarketOpen('stockholm'),
    usOpen: isMarketOpen('us'),
  };

  // Varningsloggen visar om jobbet faktiskt kört och om mejlen gått iväg.
  let alerts: { sent: number; failed: number; pending: number; latest: string | null } | null = null;
  if (configured.supabaseServiceKey) {
    try {
      const admin = createSupabaseAdminClient();
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: queryError } = await admin
        .from('alert_logs')
        .select('status, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (!queryError && data) {
        const rows = data as AlertLogRow[];
        alerts = {
          sent: rows.filter((row) => row.status === 'sent').length,
          failed: rows.filter((row) => row.status === 'failed').length,
          pending: rows.filter((row) => row.status === 'pending').length,
          latest: rows[0]?.created_at ?? null,
        };
      }
    } catch (queryError) {
      console.error('Admin status could not read alert logs:', queryError);
    }
  }

  return Response.json({ configured, access, markets, alerts, checkedAt: new Date().toISOString() });
}
