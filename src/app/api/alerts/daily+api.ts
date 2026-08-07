import { evaluateAlerts, type StockAlert } from '@/lib/alert-engine';
import { sendAlertDigest } from '@/lib/alert-email';
import { loadAlertSnapshots } from '@/lib/alert-market-data';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createUnsubscribeToken } from '@/lib/alert-unsubscribe';

interface AlertPreferenceRow { user_id: string; alert_frequency: 'DAILY_DIGEST' | 'INSTANT'; }
interface FavoriteRow { user_id: string; ticker: string; }

function localDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
}

function isStockholmDigestTime() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return hour === '17' && minute === '35';
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (new URL(request.url).searchParams.get('force') !== '1' && !isStockholmDigestTime()) {
    return Response.json({ ok: true, skipped: 'Outside the 17:35 Europe/Stockholm schedule.' });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: preferences, error: preferenceError } = await admin.from('alert_preferences')
      .select('user_id, alert_frequency')
      .eq('email_alerts_enabled', true)
      .eq('alert_frequency', 'DAILY_DIGEST');
    if (preferenceError) throw preferenceError;
    if (!preferences?.length) return Response.json({ ok: true, sent: 0, message: 'No opted-in users.' });

    const userIds = preferences.map((preference: AlertPreferenceRow) => preference.user_id);
    const { data: favorites, error: favoritesError } = await admin.from('user_favorites')
      .select('user_id, ticker')
      .in('user_id', userIds);
    if (favoritesError) throw favoritesError;

    const favoritesByUser = new Map<string, string[]>();
    (favorites || []).forEach((favorite: FavoriteRow) => {
      const tickers = favoritesByUser.get(favorite.user_id) || [];
      tickers.push(favorite.ticker);
      favoritesByUser.set(favorite.user_id, tickers);
    });
    const snapshots = await loadAlertSnapshots((favorites || []).map((favorite: FavoriteRow) => favorite.ticker));
    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    let sent = 0;

    for (const preference of preferences as AlertPreferenceRow[]) {
      const tickers = favoritesByUser.get(preference.user_id) || [];
      const alerts = tickers.flatMap((ticker) => {
        const snapshot = snapshots.get(ticker);
        return snapshot ? evaluateAlerts(snapshot) : [];
      });
      if (!alerts.length) continue;

      const userResult = await admin.auth.admin.getUserById(preference.user_id);
      const email = userResult.data.user?.email;
      if (!email) continue;

      const claimed: (StockAlert & { logId: string })[] = [];
      for (const alert of alerts) {
        const { data: logId, error } = await admin.rpc('claim_alert_log', {
          p_user_id: preference.user_id,
          p_ticker: alert.ticker,
          p_signal_type: alert.type,
          p_reasons: alert.reasons,
        });
        if (error) throw error;
        if (logId) claimed.push({ ...alert, logId });
      }
      if (!claimed.length) continue;

      try {
        const token = createUnsubscribeToken(preference.user_id);
        const emailResult = await sendAlertDigest({
          to: email,
          alerts: claimed,
          appUrl,
          unsubscribeUrl: `${appUrl}/api/alerts/unsubscribe?user=${encodeURIComponent(preference.user_id)}&token=${encodeURIComponent(token)}`,
          idempotencyKey: `daily-alert-${localDate()}-${preference.user_id}`,
        });
        const { error } = await admin.from('alert_logs').update({ status: 'sent', resend_email_id: emailResult.id }).in('id', claimed.map((alert) => alert.logId));
        if (error) {
          // Resend has already accepted the mail. Preserve the claimed cooldown rather than risk a duplicate.
          console.error('Alert email sent, but alert log could not be marked sent', error);
        }
        sent += 1;
      } catch (error) {
        console.error(`Daily alerts failed for ${preference.user_id}:`, error);
        await admin.from('alert_logs').update({ status: 'failed' }).in('id', claimed.map((alert) => alert.logId));
      }
    }

    return Response.json({ ok: true, sent, users: preferences.length });
  } catch (error) {
    console.error('Daily alert job failed:', error);
    return Response.json({ error: 'Daily alert job failed.' }, { status: 500 });
  }
}
