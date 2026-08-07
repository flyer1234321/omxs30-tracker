# Dagliga och snabba bevakningsvarningar

Den här installationen använder användarens personliga `user_favorites` och Supabase Auth. Kör följande SQL i **Supabase SQL Editor** efter att `user_favorites` är skapad.

## Uppgradering för snabba varningar

Om du redan har kört SQL-blocket nedan tidigare, kör först denna lilla migration i SQL Editor. Den lägger till det separata valet för snabba varningar utan att ändra dina befintliga inställningar.

```sql
alter table public.alert_preferences
add column if not exists instant_alerts_enabled boolean not null default false;
```

```sql
create table public.alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_alerts_enabled boolean not null default false,
  instant_alerts_enabled boolean not null default false,
  alert_frequency text not null default 'DAILY_DIGEST'
    check (alert_frequency in ('DAILY_DIGEST', 'INSTANT')),
  updated_at timestamptz not null default now()
);

alter table public.alert_preferences enable row level security;
grant select, insert, update on public.alert_preferences to authenticated;

create policy "Users manage only their own alert preferences"
on public.alert_preferences for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table public.alert_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (char_length(ticker) <= 24),
  signal_type text not null check (signal_type in ('BUY', 'SELL')),
  reasons jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  resend_email_id text,
  created_at timestamptz not null default now()
);

alter table public.alert_logs enable row level security;
create index alert_logs_cooldown_idx
on public.alert_logs (user_id, ticker, signal_type, created_at desc);

create or replace function public.claim_alert_log(
  p_user_id uuid,
  p_ticker text,
  p_signal_type text,
  p_reasons jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_ticker || ':' || p_signal_type, 0));
  if exists (
    select 1 from public.alert_logs
    where user_id = p_user_id
      and ticker = p_ticker
      and signal_type = p_signal_type
      and status in ('pending', 'sent')
      and created_at > now() - interval '7 days'
  ) then
    return null;
  end if;

  insert into public.alert_logs (user_id, ticker, signal_type, reasons)
  values (p_user_id, p_ticker, p_signal_type, p_reasons)
  returning id into claimed_id;
  return claimed_id;
end;
$$;

revoke all on function public.claim_alert_log(uuid, text, text, jsonb) from public;
grant execute on function public.claim_alert_log(uuid, text, text, jsonb) to service_role;
```

## Vercel-variabler

Lägg följande i **Vercel > Settings > Environment Variables** för Production. Lägg aldrig servernycklar i `EXPO_PUBLIC_*`.

```env
SUPABASE_SECRET_KEY=sb_secret_...
RESEND_API_KEY=re_...
RESEND_FROM="OMX30 Screener <alerts@din-verifierade-domän.se>"
APP_URL=https://omx30-appen.vercel.app
CRON_SECRET=en-slumpad-hemlighet-med-minst-16-tecken
```

Resend måste ha en verifierad avsändardomän för `RESEND_FROM`.

## Schemaläggning

Vercel Cron använder UTC. För **Vercel Pro** konfigureras två anrop för sommar- och vintertid; endpointen kör endast när tiden verkligen är 17:35 i `Europe/Stockholm`.

```json
{
  "crons": [
    { "path": "/api/alerts/daily", "schedule": "35 15 * * 1-5" },
    { "path": "/api/alerts/daily", "schedule": "35 16 * * 1-5" }
  ]
}
```

På Vercel Hobby är exakthet på minutnivå inte tillgänglig. Använd Vercel Pro eller en extern schemaläggare med tidszonsstöd innan crons-blocket läggs i `vercel.json`.

### Snabbvarningar under börsens öppettider

Snabbvarningar kontrolleras var femte minut, endast vardagar och endast mellan 09:05 och 17:35 i svensk tid. Endpointen filtrerar själv bort helg och tid utanför marknadsfönstret. Lägg till denna cron i ett Vercel Pro-projekt eller anropa samma endpoint från en extern schemaläggare med headern `Authorization: Bearer CRON_SECRET`.

```json
{ "path": "/api/alerts/live", "schedule": "*/5 7-17 * * 1-5" }
```

En snabbvarning skickas bara för högprioriterade lägen: volymbekräftat brott under SMA200, extrem rusning med RSI över 80, flera samtidiga risksignaler eller ett ovanligt komplett köpläge. Vanliga signaler hamnar i den dagliga sammanfattningen.

## Test

Efter att servervariablerna och SQL är på plats kan endpointen testas manuellt med cron-hemligheten:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://omx30-appen.vercel.app/api/alerts/daily?force=1"
```

Slå på **Varningar** i appen för ditt eget konto innan testet. `force=1` används endast vid manuellt test och kringgår klockslagskontrollen.

Testa snabbvarnings-endpointen på samma sätt:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://omx30-appen.vercel.app/api/alerts/live?force=1"
```
