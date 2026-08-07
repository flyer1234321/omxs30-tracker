# Supabase: personliga favoriter

Anvand ett befintligt Supabase-projekt. Skapa tabellen i **SQL Editor** med foljande SQL:

```sql
create table public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (char_length(ticker) <= 24),
  created_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table public.user_favorites enable row level security;

grant select, insert, update, delete on public.user_favorites to authenticated;

create policy "Users manage only their own favorites"
on public.user_favorites
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

In **Authentication > URL Configuration**, set the Site URL to the production URL and add both redirect URLs:

```text
http://localhost:8082/**
https://omx30-appen.vercel.app/**
```

Add these values to `.env.local` and to Vercel Production environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
APP_ALLOWED_EMAILS=you@example.com,friend@example.com
```

`EXPO_PUBLIC_SUPABASE_ANON_KEY` can be used instead for older Supabase projects. Do not add the service role key to this application.
