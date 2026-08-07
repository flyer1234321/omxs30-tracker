import { invalidateAuthCaches, requireAdminUser } from '@/lib/app-auth';
import { envAdminEmails, invalidateAppUserCache, loadAppUsers } from '@/lib/app-users';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requireDatabase() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    return Response.json(
      { error: 'Användarhantering kräver SUPABASE_SECRET_KEY och tabellen app_users.' },
      { status: 503 },
    );
  }
  return null;
}

/** Ändringar ska synas direkt, inte när minutcachen råkar löpa ut. */
function refreshCaches() {
  invalidateAppUserCache();
  invalidateAuthCaches();
}

export async function GET(request: Request) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  const users = await loadAppUsers(true);
  return Response.json({
    users: users ?? [],
    // Miljöadministratörerna kan inte redigeras härifrån, men bör synas så att
    // listan inte ser tommare ut än den är.
    envAdmins: envAdminEmails(),
    databaseAvailable: users !== null,
  });
}

export async function POST(request: Request) {
  const { error, user } = await requireAdminUser(request);
  if (error) return error;
  const databaseError = requireDatabase();
  if (databaseError) return databaseError;

  let body: { email?: unknown; isAdmin?: unknown; canUseAi?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: 'Ogiltig begäran.' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!EMAIL_PATTERN.test(email)) {
    return Response.json({ error: 'Ange en giltig e-postadress.' }, { status: 400 });
  }

  // En administratör ska inte kunna ta ifrån sig själv sina egna rättigheter
  // och därmed låsa ut sig ur den här vyn.
  const editingSelf = user?.email != null && user.email === email;
  const isAdmin = editingSelf ? true : Boolean(body.isAdmin);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error: upsertError } = await admin
      .from('app_users')
      .upsert({
        email,
        is_admin: isAdmin,
        can_use_ai: Boolean(body.canUseAi),
        disabled_at: null,
      }, { onConflict: 'email' })
      .select('email, is_admin, can_use_ai, created_at, disabled_at')
      .single();
    if (upsertError) throw upsertError;

    const row = data as { email: string; is_admin: boolean; can_use_ai: boolean; created_at: string | null; disabled_at: string | null };
    refreshCaches();
    return Response.json({
      user: {
        email: row.email,
        isAdmin: row.is_admin,
        canUseAi: row.can_use_ai,
        createdAt: row.created_at,
        disabledAt: row.disabled_at,
      },
      selfProtected: editingSelf && !body.isAdmin,
    });
  } catch (upsertError) {
    console.error('Could not save app user:', upsertError);
    return Response.json({ error: 'Kunde inte spara användaren.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error, user } = await requireAdminUser(request);
  if (error) return error;
  const databaseError = requireDatabase();
  if (databaseError) return databaseError;

  const email = normalizeEmail(new URL(request.url).searchParams.get('email'));
  if (!email) return Response.json({ error: 'E-postadress saknas.' }, { status: 400 });

  if (user?.email != null && user.email === email) {
    return Response.json({ error: 'Du kan inte ta bort ditt eget konto.' }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { error: deleteError } = await admin.from('app_users').delete().eq('email', email);
    if (deleteError) throw deleteError;

    refreshCaches();
    // Inloggningskontot och favoriterna lämnas orörda: åtkomsten dras in, men
    // användaren får tillbaka allt om hen läggs till igen.
    return Response.json({ removed: email });
  } catch (deleteError) {
    console.error('Could not remove app user:', deleteError);
    return Response.json({ error: 'Kunde inte ta bort användaren.' }, { status: 500 });
  }
}
