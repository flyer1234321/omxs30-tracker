import { createHash } from 'node:crypto';
import { evaluateAlerts, isUrgentLiveAlert, type StockAlert } from '@/lib/alert-engine';
import { sendAlertDigest } from '@/lib/alert-email';
import { loadAlertSnapshots } from '@/lib/alert-market-data';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createUnsubscribeToken } from '@/lib/alert-unsubscribe';
import { getAuthenticatedUser } from '@/lib/app-auth';

type Delivery = 'daily' | 'live';
interface AlertPreferenceRow { user_id: string; }
interface FavoriteRow { user_id: string; ticker: string; }

function localDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
}

function emailIdempotencyKey(delivery: Delivery, userId: string, logIds: string[]) {
  return createHash('sha256').update(`${delivery}:${userId}:${logIds.sort().join(':')}`).digest('hex');
}

/**
 * Jobbet körs normalt av schemaläggaren med CRON_SECRET. En administratör ska
 * också kunna utlösa det manuellt från appen för att se att kedjan fungerar,
 * utan att behöva ha hemligheten till hands.
 */
async function isAuthorizedJobRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true;
  const user = await getAuthenticatedUser(request);
  return Boolean(user?.isAdmin);
}

export async function runAlertJob(request: Request, delivery: Delivery) {
  if (!await isAuthorizedJobRequest(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const preferenceColumn = delivery === 'live' ? 'instant_alerts_enabled' : 'email_alerts_enabled';
    const { data: preferences, error: preferenceError } = await admin.from('alert_preferences')
      .select('user_id')
      .eq(preferenceColumn, true);
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
      }).filter((alert) => delivery === 'daily' || isUrgentLiveAlert(alert));
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
          idempotencyKey: emailIdempotencyKey(delivery, preference.user_id, claimed.map((alert) => alert.logId)),
          subject: delivery === 'live' ? `Viktig marknadssignal: ${claimed.length} favorit${claimed.length === 1 ? '' : 'er'}` : undefined,
        });
        const { error } = await admin.from('alert_logs').update({ status: 'sent', resend_email_id: emailResult.id }).in('id', claimed.map((alert) => alert.logId));
        if (error) console.error('Alert email sent, but alert log could not be marked sent', error);
        sent += 1;
      } catch (error) {
        console.error(`${delivery} alerts failed for ${preference.user_id}:`, error);
        await admin.from('alert_logs').update({ status: 'failed' }).in('id', claimed.map((alert) => alert.logId));
      }
    }

    return Response.json({ ok: true, sent, users: preferences.length, delivery, date: localDate() });
  } catch (error) {
    console.error(`${delivery} alert job failed:`, error);
    return Response.json({ error: `${delivery} alert job failed.` }, { status: 500 });
  }
}
