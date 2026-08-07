# Användarhantering

Behörigheter låg tidigare i miljövariabeln `APP_ALLOWED_EMAILS`, vilket innebar att varje ny användare krävde en ny deploy. De ligger nu i tabellen `app_users` och kan redigeras direkt från appens administrationsvy.

Kör följande i **Supabase SQL Editor**:

```sql
create table public.app_users (
  email text primary key,
  is_admin boolean not null default false,
  can_use_ai boolean not null default false,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);

alter table public.app_users enable row level security;

-- Ingen policy för authenticated: tabellen läses och skrivs enbart av servern
-- med servicenyckeln. Klienten ska aldrig kunna se vilka konton som finns.
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

AI-analysen är det enda i appen som kostar pengar per anrop, och därför det enda som styrs per användare. Saknas behörigheten svarar endpointen ändå — med kvantanalysen, inte med ett felmeddelande.

## Att lägga till och ta bort

Att lägga till en användare betyder bara att adressen förs in i tabellen. Något lösenord skapas inte: personen loggar in med en engångslänk till sin e-post, och Supabase-kontot skapas första gången länken används.

Att ta bort drar in åtkomsten men rör varken inloggningskontot eller favoritlistan. Läggs personen till igen finns allt kvar.

Du kan inte ta bort ditt eget konto eller dina egna administratörsrättigheter från vyn.
