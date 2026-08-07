import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hasValidUnsubscribeToken } from '@/lib/alert-unsubscribe';

function html(message: string) {
  return new Response(`<!doctype html><html lang="sv"><body style="font-family:-apple-system,sans-serif;padding:32px;color:#172033"><h1>OMX30 Screener</h1><p>${message}</p></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user') || '';
  const token = url.searchParams.get('token');
  if (!userId || !hasValidUnsubscribeToken(userId, token)) return false;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('alert_preferences').upsert({
    user_id: userId,
    email_alerts_enabled: false,
    alert_frequency: 'DAILY_DIGEST',
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}

export async function GET(request: Request) {
  try {
    return await unsubscribe(request) ? html('Du är nu avregistrerad från OMX30 Screener-varningar.') : new Response('Invalid link', { status: 400 });
  } catch {
    return new Response('Could not update preferences', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await unsubscribe(request) ? new Response(null, { status: 200 }) : new Response(null, { status: 400 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
