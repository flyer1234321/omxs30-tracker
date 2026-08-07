# OMX30 Screener

Aktiescreener för Stockholmsbörsen och ett urval amerikanska bolag. Byggd med Expo Router och körs som en webbapp på Vercel, men samma kod går att köra som iOS- och Android-app.

Appen är beslutsstöd. Den ger inte personlig investeringsrådgivning, och all marknadsdata kan vara fördröjd eller ofullständig.

## Vad appen gör

- **Screener** över OMXS30, ett bredare svenskt urval, svenska fastighetsbolag, Dow Jones, storbolag inom teknik samt en egen favoritlista.
- **Hälsobetyg A–F** som väger sex grundkriterier och tre tekniska bonusar. Betyget premierar rekyler och rabatt, inte kvalitet i sig: en aktie i stark uppåttrend får sällan A.
- **Handelsplan** per aktie: stop loss och riktkurs härledda ur ATR och närliggande stöd och motstånd, uttryckta i kronor, procent och R-multipel.
- **Pro Filter** med sparbara vyer (workspaces) och färdiga strategier.
- **Analyst AI** som sammanfattar styrkor, risker och katalysatorer. Utan `OPENAI_API_KEY` används en regelbaserad analys i stället.
- **E-postvarningar** för favoritlistan, som daglig sammanfattning eller som snabbvarning vid högprioriterade lägen.
- **Utskriftsvänlig rapport** som kan sparas som PDF från webbläsaren.

## Kom igång

```bash
npm install
cp .env.example .env.local   # fyll i värdena, se nedan
npm start
```

| Kommando | Gör |
| --- | --- |
| `npm start` | Startar Expo i utvecklingsläge |
| `npm run web` | Startar bara webbversionen |
| `npm test` | Kör enhetstesterna |
| `npm run typecheck` | Typkontroll utan att bygga |
| `npm run lint` | ESLint |
| `npm run build:web` | Bygger webbversionen till `dist/` |

## Miljövariabler

Se `.env.example` för fullständig lista. Kort sammanfattning:

| Variabel | Krävs för |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Inloggning med e-post och favoriter i molnet |
| `APP_ACCESS_PASSWORD`, `APP_SESSION_SECRET` | Alternativ inloggning med enbart lösenord |
| `APP_ALLOWED_EMAILS` | Begränsar vilka konton som får logga in |
| `APP_ADMIN_EMAILS` | Vilka konton som ser administrationsvyn |
| `OPENAI_API_KEY` | AI-skriven analystext (frivilligt) |
| `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, `APP_URL` | E-postvarningar |

Servernycklar får aldrig ligga i variabler som börjar med `EXPO_PUBLIC_`; de skickas till klienten.

### Inloggning

De två sätten att logga in fungerar parallellt. Är båda konfigurerade visas e-postlänken först, med lösenordet som reservväg under. Det är avsiktligt: ett försenat mejl eller en Supabase som ligger nere ska inte kunna låsa ute dig från din egen app.

Administratörer anges i `APP_ADMIN_EMAILS`. Den som loggar in med `APP_ACCESS_PASSWORD` räknas alltid som administratör, eftersom det är en serverhemlighet. Administratörer ser en extra knapp i rubriken som visar vilka miljövariabler som är satta (aldrig deras värden), om börserna är öppna, hur varningsutskicken gått de senaste två veckorna, och en knapp för att köra bevakningsjobbet direkt.

**Viktigt om e-postlänkarna:** Supabase inbyggda utskick ligger på ett par mejl i timmen på gratisnivån. Konfigurera egen SMTP under Project Settings → Authentication → SMTP och peka den mot samma Resend-konto som varningarna använder, annars slutar inloggningslänkarna komma fram efter några försök.

Installationsanvisningar för databasen finns i [docs/supabase-favorites-setup.md](docs/supabase-favorites-setup.md) och [docs/supabase-alerts-setup.md](docs/supabase-alerts-setup.md).

## Datakällor och gränser

Kursdata hämtas från Yahoo Finance via `yahoo-finance2`. Det är ett inofficiellt gratis-API utan garanterad tillgänglighet, och det stryper trafik per IP-adress. Koden är därför byggd för att hålla nere antalet anrop:

- högst sex parallella hämtningar
- svaren cachas fem minuter när börsen är öppen och en timme när den är stängd
- klienten hämtar nytt var femte minut, och bara under börstid
- gammal data visas hellre än ett felmeddelande när Yahoo inte svarar

Håll dessa gränser i åtanke innan pollningen görs tätare.

## Projektstruktur

```
src/
  app/            Skärmar och API-rutter (Expo Router, filbaserad routing)
    api/          Serverendpoints: analyze, history, intraday, search, analyst, alerts
  components/     Gränssnitt
  lib/            Beräkningar och affärslogik, med enhetstester bredvid
  types/          Delade typer
  theme.ts        Färger, avstånd och typsnitt
```

Beräkningarna i `src/lib` är rena funktioner utan React-beroenden, vilket gör dem enkla att testa. Kör `npm test` efter ändringar där.

## Licens

MIT, se [LICENSE](LICENSE).
