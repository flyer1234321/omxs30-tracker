# Användarhantering

Behörigheter låg tidigare i miljövariabeln `APP_ALLOWED_EMAILS`, vilket innebar att varje ny användare krävde en ny deploy. De ligger nu i tabellen `app_users` och kan redigeras direkt från appens administrationsvy.

Kör följande i **Supabase SQL Editor**:

```sql
create table public.app_users (
  email text primary key,
  is_admin boolean not null default false,
  can_use_ai boolean not null default false,
  ai_daily_limit integer not null default 5 check (ai_daily_limit between 0 and 100),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

alter table public.app_users enable row level security;

-- Ingen policy för authenticated: tabellen läses och skrivs enbart av servern
-- med servicenyckeln. Klienten ska aldrig kunna se vilka konton som finns.
```

## Uppgradering: dagsgräns för AI

Har tabellen redan skapats, kör hela blocket nedan en gång. `0` betyder
obegränsat. Räknaren använder svensk kalenderdag och uppdateras atomiskt, så
två samtidiga anrop kan inte passera samma gräns.

```sql
alter table public.app_users
add column if not exists ai_daily_limit integer not null default 5
check (ai_daily_limit between 0 and 100);

create table if not exists public.ai_request_usage (
  email text not null references public.app_users(email) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (email, usage_date)
);

alter table public.ai_request_usage enable row level security;

create or replace function public.claim_ai_request(
  p_email text,
  p_daily_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stockholm_date date := (now() at time zone 'Europe/Stockholm')::date;
  used_count integer;
begin
  if p_daily_limit <= 0 then
    return 2147483647;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(p_email) || ':' || stockholm_date::text, 0));

  select request_count into used_count
  from public.ai_request_usage
  where email = lower(p_email) and usage_date = stockholm_date;

  used_count := coalesce(used_count, 0);
  if used_count >= p_daily_limit then
    return -1;
  end if;

  insert into public.ai_request_usage (email, usage_date, request_count, updated_at)
  values (lower(p_email), stockholm_date, used_count + 1, now())
  on conflict (email, usage_date) do update
  set request_count = excluded.request_count, updated_at = now();

  return p_daily_limit - used_count - 1;
end;
$$;

revoke all on function public.claim_ai_request(text, integer) from public;
grant execute on function public.claim_ai_request(text, integer) to service_role;
```

Lägg också till adressen till den första administratören som miljövariabel, i `.env.local` och i Vercel:

```env
APP_ADMIN_EMAILS=du@example.com
```

## Hur behörigheterna läses

Ordningen är medvetet vald för att det inte ska gå att låsa ut sig själv:

1. **`APP_ADMIN_EMAILS` gäller alltid.** Adresser där är administratörer oavsett vad som står i tabellen. Utan den utvägen skulle ett felklick kunna spärra den sista administratören ute.
2. **Finns rader i `app_users` styr den.** Konton som saknas i tabellen, eller har `disabled_at` satt, nekas.
3. **Är tabellen tom används `APP_ALLOWED_EMAILS`.** Det gör att en befintlig installation fortsätter fungera tills den första användaren lagts in.
4. **Svarar inte databasen faller allt tillbaka på miljövariablerna.** En Supabase som ligger nere ska inte stänga appen.

Resultatet cachas i 60 sekunder per token, men rensas direkt när en administratör ändrat något, så ändringar slår igenom omedelbart.

## Rättigheter

| Flagga | Betydelse |
| --- | --- |
| `is_admin` | Ser administrationsvyn, hanterar användare, kan köra varningsjobbet manuellt |
| `can_use_ai` | Får den AI-skrivna analystexten. Utan den visas den regelbaserade analysen i stället |
| `ai_daily_limit` | Högsta antal nya betalda AI-anrop per svensk kalenderdag. `0` = obegränsat |

AI-analysen är det enda i appen som kostar pengar per anrop, och därför det enda som styrs per användare. Saknas behörigheten svarar endpointen ändå — med kvantanalysen, inte med ett felmeddelande.

## Att lägga till och ta bort

Att lägga till en användare betyder bara att adressen förs in i tabellen. Något lösenord skapas inte: personen loggar in med en engångslänk till sin e-post, och Supabase-kontot skapas första gången länken används.

Att ta bort drar in åtkomsten men rör varken inloggningskontot eller favoritlistan. Läggs personen till igen finns allt kvar.

Du kan inte ta bort ditt eget konto eller dina egna administratörsrättigheter från vyn.
