function allowedEmails() {
  return (process.env.APP_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: 'Inloggningstjänsten är inte konfigurerad.' }, { status: 503 });

  let email = '';
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {}

  if (!email || !email.includes('@')) return Response.json({ error: 'Ange en giltig e-postadress.' }, { status: 400 });
  const allowlist = allowedEmails();
  if (allowlist.length > 0 && !allowlist.includes(email)) {
    return Response.json({ error: 'Den här e-postadressen har inte åtkomst.' }, { status: 403 });
  }

  const redirectTo = new URL(request.url).origin;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ email, create_user: true, redirect_to: redirectTo }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { msg?: string; message?: string } | null;
      return Response.json({ error: payload?.msg || payload?.message || 'Kunde inte skicka inloggningslänken.' }, { status: response.status });
    }
    return Response.json({ sent: true });
  } catch (error) {
    console.error('Supabase magic-link request failed', error);
    return Response.json({ error: 'Kunde inte nå inloggningstjänsten. Försök igen om en stund.' }, { status: 502 });
  }
}
