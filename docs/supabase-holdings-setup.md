# Innehav

Antal aktier och genomsnittligt anskaffningsvärde per bolag. Uppgifterna gör resten av appen personlig: handelsplanens risk blir ett belopp i stället för en procentsats, och positionens andel av portföljen går att se.

Kör följande i **Supabase SQL Editor**:

```sql
create table public.user_holdings (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (char_length(ticker) <= 24),
  shares numeric(18, 6) not null check (shares > 0),
  average_price numeric(18, 6) not null check (average_price > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table public.user_holdings enable row level security;

grant select, insert, update, delete on public.user_holdings to authenticated;

create policy "Users manage only their own holdings"
on public.user_holdings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Till skillnad från `app_users` har den här tabellen en policy för `authenticated`. Klienten läser och skriver sina egna innehav direkt, precis som med favoriterna, och policyn ser till att ingen kommer åt någon annans.

`numeric` i stället för `float` är medvetet: belopp ska inte drabbas av avrundningsfel i binära flyttal. Sex decimaler räcker för mäklare som handlar i andelar av aktier.

## Utan Supabase

Loggar du in med serverlösenordet finns ingen Supabase-session, och innehaven sparas då bara lokalt i webbläsaren. De följer alltså inte med till en annan enhet. Appen försöker inte spara dem i molnet i det läget — uppgifter om innehav ska inte hamna hos fel användare.

## Vad appen räknar, och inte

Beräkningarna bygger enbart på antal och anskaffningsvärde. Courtage, utdelningar, valutaväxling och skatt ingår inte, och en aktiesplit måste uppdateras för hand.

Splitfallet är det enda som är riktigt lömskt: kurshistoriken från Yahoo är redan splitjusterad, så om antalet aktier inte uppdateras blir avkastningen tyst fel. Appen varnar när kursen ligger orimligt långt från registrerat anskaffningsvärde, vilket fångar de flesta fall.
