import { getAuthenticatedUser, requireAuthenticatedUser } from '@/lib/app-auth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const DEFAULTS = {
  email_alerts_enabled: false,
  instant_alerts_enabled: false,
};

async function authenticatedSupabaseUser(request: Request) {
  const error = await requireAuthenticatedUser(request);
  if (error) return { error, user: null };
  const user = await getAuthenticatedUser(request);
  if (!user || user.provider !== 'supabase') {
    return {
      error: Response.json(
        { error: 'Personliga varningar kräver inloggning med e-postlänk.' },
        { status: 409 },
      ),
      user: null,
    };
  }
  return { error: null, user };
}

function databaseError(error: unknown) {
  console.error('Could not access alert preferences:', error);
  return Response.json(
    { error: 'Varningstabellen kunde inte läsas. Kör SQL-blocket i docs/supabase-alerts-setup.md.' },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const { error, user } = await authenticatedSupabaseUser(request);
  if (error || !user) return error;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error: readError } = await admin
      .from('alert_preferences')
      .select('email_alerts_enabled, instant_alerts_enabled')
      .eq('user_id', user.id)
      .maybeSingle();
    if (readError) throw readError;
    return Response.json({ preferences: data ?? DEFAULTS });
  } catch (readError) {
    return databaseError(readError);
  }
}

export async function POST(request: Request) {
  const { error, user } = await authenticatedSupabaseUser(request);
  if (error || !user) return error;

  let body: { email_alerts_enabled?: unknown; instant_alerts_enabled?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Ogiltig begäran.' }, { status: 400 });
  }

  try {
    const preferences = {
      user_id: user.id,
      email_alerts_enabled: Boolean(body.email_alerts_enabled),
      instant_alerts_enabled: Boolean(body.instant_alerts_enabled),
      alert_frequency: 'DAILY_DIGEST',
      updated_at: new Date().toISOString(),
    };
    const admin = createSupabaseAdminClient();
    const { error: saveError } = await admin
      .from('alert_preferences')
      .upsert(preferences, { onConflict: 'user_id' });
    if (saveError) throw saveError;
    return Response.json({ preferences });
  } catch (saveError) {
    return databaseError(saveError);
  }
}
