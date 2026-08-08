/**
 * En ordlista för hela appen.
 *
 * Samma begrepp förklarades tidigare på fyra ställen med olika formuleringar:
 * kolumnrubrikerna i tabellen, kolumnkatalogen i workspaces, hjälprutan i
 * Pro Filter och nyckeltalen i detaljvyn. De gick isär över tid, och en
 * rättelse på ett ställe nådde aldrig de andra.
 *
 * Varje post har tre delar med olika syfte:
 *
 * - `short` är en rad som ska kunna läsas i förbifarten.
 * - `detail` förklarar vad talet faktiskt mäter.
 * - `caution` är den vanligaste feltolkningen. Det fältet är det viktigaste:
 *   ett nyckeltal blir farligt först när man tror att det säger mer än det gör.
 */

export interface GlossaryEntry {
  term: string;
  short: string;
  detail: string;
  caution?: string;
}

export const GLOSSARY = {
  // ─── Tabellkolumner ──────────────────────────────────────────────
  ticker: {
    term: 'Ticker',
    short: 'Aktiens symbol på börsen.',
    detail: 'Den korta beteckning aktien handlas under. Klicka på raden för att öppna hela analysen med graf, nyckeltal och handelsplan.',
  },
  grade: {
    term: 'Rekylläge',
    short: 'Hur tydligt aktien fallit tillbaka, A till F.',
    detail: 'Måttet letar efter aktier som gått ned mycket: stort fall från toppen, nära årslägsta, lågt RSI och kurs under halvårssnittet. Fyra av de sex grundkriterierna mäter alltså samma nedgång från olika håll. A betyder starkast rekylläge, inte bästa bolag.',
    caution: 'Ett tydligt rekylläge säger ingenting om varför kursen fallit. Läs det tillsammans med Kvalitet: stort fall och svag ekonomi är den kombination som gör rekylmodeller farliga.',
  },
  price: {
    term: 'Pris',
    short: 'Senast betalda kurs.',
    detail: 'Senaste kurs i aktiens egen handelsvaluta. Data kommer från Yahoo Finance och kan vara fördröjd med upp till en kvart.',
  },
  change: {
    term: '% idag',
    short: 'Kursförändring under dagens handel.',
    detail: 'Rörelsen sedan gårdagens stängning, i procent.',
    caution: 'En stor dagsrörelse säger inget om orsaken. Kontrollera om bolaget rapporterar innan du tolkar den som en signal.',
  },
  rsi: {
    term: 'RSI',
    short: 'Momentum på skalan 0 till 100.',
    detail: 'Mäter hur mycket av de senaste fjorton dagarnas rörelse som varit uppåt. Under 30 brukar kallas översålt, över 70 överköpt.',
    caution: 'Låg RSI betyder att fallet varit brant, inte att det är slut. I en fallande trend kan RSI ligga under 30 i veckor.',
  },
  volume: {
    term: 'Volym',
    short: 'Omsättning mot 20-dagarssnittet.',
    detail: 'Senaste handelsdagens volym delat med snittet för de tjugo föregående. 2,0x betyder dubbelt så mycket omsatt som vanligt.',
    caution: 'Hög volym bekräftar att rörelsen är på riktigt, men säger inget om riktningen. Både panik och köplust ser likadana ut här.',
  },
  pe: {
    term: 'P/E',
    short: 'Pris delat med vinst per aktie.',
    detail: 'Hur många årsvinster du betalar för aktien. Ett P/E på 15 betyder att priset motsvarar femton års nuvarande vinst.',
    caution: 'Lågt är inte automatiskt billigt. Ett lågt P/E speglar ofta att marknaden väntar sig fallande vinster. Jämför med bolagets egen historik och med sektorn.',
  },
  sma: {
    term: 'SMA',
    short: 'Kursen mot sitt halvårssnitt.',
    detail: 'Pilen visar om kursen ligger över eller under det glidande medelvärdet för 125 handelsdagar, alltså ungefär ett halvår.',
    caution: 'Ett glidande medelvärde beskriver var kursen varit, inte vart den ska. Det är en trendbeskrivning, inte en prognos.',
  },
  volatility: {
    term: 'Volatilitet',
    short: 'Hur mycket kursen svänger, per år.',
    detail: 'Årsomräknad standardavvikelse från de senaste 20 handelsdagarna. 30 % betyder att kursen typiskt rör sig inom ±30 % på ett år.',
    caution: 'Måttet är bakåtblickande. Låg volatilitet historiskt garanterar inte lugn framöver, och stiger ofta kraftigt just när något händer.',
  },
  beta: {
    term: 'Beta',
    short: 'Känslighet mot index.',
    detail: 'Hur mycket aktien historiskt rört sig när index rört sig en procent. Beta 1,5 innebär att aktien typiskt svängt 50 % mer än marknaden.',
    caution: 'Beta mäter samvariation, inte risk i bolaget. En aktie kan ha låg beta och ändå vara mycket riskfylld på egen hand.',
  },
  drawdown: {
    term: 'Max DD',
    short: 'Största fallet från en tidigare topp.',
    detail: 'Den djupaste nedgången från topp till botten under det senaste året. Visar hur mycket man behövt uthärda för att behålla aktien.',
    caution: 'Historisk drawdown är ett golv man vet har inträffat, inte ett tak för vad som kan hända.',
  },
  relativeStrength: {
    term: 'Mot index',
    short: 'Avkastning minus indexets, tre månader.',
    detail: 'Aktiens utveckling de senaste 63 handelsdagarna med indexets rörelse borträknad. Positivt tal betyder att aktien gått bättre än marknaden.',
    caution: 'Relativ styrka har historiskt tenderat att bestå en tid, men vänder ofta abrupt. Den säger inget om värderingen.',
  },
  quality: {
    term: 'Kvalitet',
    short: 'Bolagets ekonomi, 0 till 10.',
    detail: 'Väger skuldsättning, avkastning på eget kapital, rörelsemarginal, fritt kassaflöde och omsättningstillväxt. Måttet är avsiktligt skilt från rekylläget: rekylläget mäter om kursen fallit, kvalitet om fallet är befogat.',
    caution: 'Siffrorna är ett kvartal gamla och ersätter inte rapporten. För banker och fastighetsbolag utgår skuldsättningen, eftersom hög belåning hör till affärsmodellen.',
  },
  trend: {
    term: '7d trend',
    short: 'Kursen de senaste sju dagarna.',
    detail: 'En miniatyrgraf över den senaste veckans stängningskurser. Ger en känsla för riktningen utan att öppna aktien.',
  },

  // ─── Vyer ────────────────────────────────────────────────────────
  workspaceOverview: {
    term: 'Översikt',
    short: 'Balanserad grundvy.',
    detail: 'Rekylläge, prisrörelse, RSI, volym, värdering och trend i samma tabell. Utgångspunkten när du inte letar efter något särskilt.',
  },
  workspaceMomentum: {
    term: 'Momentum',
    short: 'Styrkan i den pågående rörelsen.',
    detail: 'Dagsförändring, RSI, relativ volym, utveckling mot index och volatilitet. Vyn för frågan: vad rör sig, och rör det sig på riktigt?',
    caution: 'Momentum beskriver vad som redan hänt. Den som köper det som stigit mest köper också det som fallit djupast när stämningen vänder.',
  },
  workspaceRisk: {
    term: 'Risk',
    short: 'Nedsida och svängningar.',
    detail: 'Volatilitet, beta, största historiska nedgång och bolagets ekonomiska kvalitet. Vyn för frågan: hur mycket kan det svänga, och tål bolaget att det gör det?',
  },
  workspaceValue: {
    term: 'Värde',
    short: 'Värdering och kvalitet.',
    detail: 'Rekylläge, kvalitet, P/E och volym. Vyn hjälper dig att jämföra värdering och bolagsekonomi, men avgör inte vad aktien egentligen är värd.',
    caution: 'Låg värdering och bra bolag är två olika saker. Det billigaste i listan är ofta billigt av en anledning.',
  },

  // ─── Nyckeltal i detaljvyn ───────────────────────────────────────
  open: {
    term: 'Öppning',
    short: 'Dagens första betalkurs.',
    detail: 'Jämför med gårdagens stängning för att se om aktien öppnade med ett gap, vilket ofta betyder att något hänt över natten.',
  },
  dayHigh: {
    term: 'Högsta',
    short: 'Högsta kurs i dag.',
    detail: 'Var säljarna hittills tagit över under dagen.',
  },
  dayLow: {
    term: 'Lägsta',
    short: 'Lägsta kurs i dag.',
    detail: 'Var köparna hittills stigit in under dagen.',
  },
  marketCap: {
    term: 'Börsvärde',
    short: 'Bolagets totala marknadsvärde.',
    detail: 'Aktiekursen multiplicerad med antalet aktier. Säger något om storlek och likviditet, inte om värderingen.',
  },
  fiftyTwoWeekHigh: {
    term: '52v hög',
    short: 'Högsta kurs senaste året.',
    detail: 'Nivån fungerar ofta som motstånd: många som köpt där vill komma ur på samma nivå.',
  },
  fiftyTwoWeekLow: {
    term: '52v låg',
    short: 'Lägsta kurs senaste året.',
    detail: 'Nivån fungerar ofta som stöd, men ett brott nedåt genom den är samtidigt en av de tydligare svaghetssignalerna.',
  },
  avgVolume: {
    term: 'Snittvolym',
    short: 'Genomsnittlig omsättning, 20 dagar.',
    detail: 'Jämförelsetalet som dagens volym mäts mot. Låg snittvolym betyder också att det kan vara svårt att komma ur en större post.',
  },
  dividendYield: {
    term: 'Direktavkastning',
    short: 'Utdelning som andel av kursen.',
    detail: 'Årets utdelning delat med dagens kurs.',
    caution: 'En ovanligt hög siffra beror oftare på att kursen fallit än på att utdelningen höjts, och kan betyda att marknaden väntar sig en sänkning.',
  },
  eps: {
    term: 'VPA',
    short: 'Vinst per aktie, tolv månader.',
    detail: 'Bolagets vinst fördelad per aktie de senaste fyra kvartalen. Tillsammans med kursen ger den P/E-talet.',
  },
  priceToBook: {
    term: 'P/B',
    short: 'Pris mot bokfört eget kapital.',
    detail: 'Under 1 betyder att bolaget värderas lägre än summan av vad som står i balansräkningen.',
    caution: 'Måttet fungerar bäst för banker och fastighetsbolag, där tillgångarna är verkliga och värderbara. För tjänstebolag säger det nästan ingenting.',
  },
  atr: {
    term: 'ATR',
    short: 'Genomsnittlig dagsrörelse.',
    detail: 'Average True Range: hur många kronor kursen typiskt rör sig under en dag, inklusive gap. Används för att lägga stop loss på ett avstånd som passar just den här aktien.',
    caution: 'En stop loss närmare än en ATR träffas ofta av vanligt brus, utan att något faktiskt förändrats.',
  },
  earnings: {
    term: 'Rapport',
    short: 'Dagar till nästa kvartalsrapport.',
    detail: 'Kring en rapport styrs kursen av innehållet i den, inte av tekniska nivåer.',
    caution: 'Tekniska signaler väger lättare strax före en rapport. Många väljer att avvakta tills siffrorna är ute.',
  },

  // ─── Handelsplanen ───────────────────────────────────────────────
  stopLoss: {
    term: 'Stop loss',
    short: 'Nivån där tesen är fel.',
    detail: 'Lagd två ATR under kursen, eller strax under ett glidande medelvärde som ligger där. Tanken är att avståndet ska vara större än vanligt brus men mindre än en verklig trendvändning.',
    caution: 'Nivån är mekanisk och känner varken till rapporter eller nyheter. Den ersätter inte ett eget beslut.',
  },
  target: {
    term: 'Riktkurs',
    short: 'Närmaste motstånd ovanför.',
    detail: 'Sätts vid det första glidande medelvärdet eller 52-veckorshögsta över dagens kurs, annars tre ATR upp.',
    caution: 'Det är en nivå där kursen historiskt mött motstånd, inte en prognos om vart den ska.',
  },
  rMultiple: {
    term: 'R-multipel',
    short: 'Vinstpotential delat med risk.',
    detail: 'Avståndet till riktkursen delat med avståndet till stoppen. 2R betyder att du riskerar en krona för att kunna tjäna två.',
    caution: 'Under 1R riskerar du mer än du rimligen kan vinna till närmaste motstånd. Det är inget säljråd, men värt att se innan köp.',
  },

  // ─── Signaler ────────────────────────────────────────────────────
  goldenCross: {
    term: 'Golden Cross',
    short: 'SMA 50 korsade upp genom SMA 200.',
    detail: 'Det kortare snittet har passerat det längre underifrån. Det beskriver hur den senaste kursutvecklingen skiljer sig från den längre trenden.',
    caution: 'Båda snitten är eftersläpande. Korsningen bevisar varken en varaktig vändning eller framtida uppgång.',
  },
  volumeSpike: {
    term: 'Volymspik',
    short: 'Minst dubbel snittvolym.',
    detail: 'Ovanligt många aktier har bytt ägare, vilket betyder att marknaden omprövat något.',
    caution: 'Spiken säger inte åt vilket håll omprövningen gick. Titta på kursen samma dag.',
  },
  valueDiscount: {
    term: 'Lägre P/E-proxy',
    short: 'P/E under en prisbaserad 12-månadersreferens.',
    detail: 'Dagens P/E är minst 20 % under medianpriset för året delat med dagens VPA. Vinsten hålls alltså konstant i hela jämförelsen.',
    caution: 'Detta är inte bolagets verkliga historiska P/E-serie och inte ett mått på inneboende värde. Ändrad vinst eller risk kan motivera skillnaden.',
  },
  earningsSoon: {
    term: 'Rapport snart',
    short: 'Kvartalsrapport inom en vecka.',
    detail: 'Bolaget rapporterar inom sju dagar.',
    caution: 'Rörelser kring rapport följer sällan tekniska signaler. Väg in det innan du agerar på övriga märkningar.',
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

const GLOSSARY_EN: Partial<Record<GlossaryKey, GlossaryEntry>> = {
  ticker: { term: 'Ticker', short: 'The share symbol used by the exchange.', detail: 'The short identifier under which the share trades. Select the row to open the full analysis.' },
  grade: { term: 'Pullback grade', short: 'How clearly the share has pulled back, A to F.', detail: 'Combines the decline from the peak, proximity to the yearly low, RSI and price versus its average. A is the strongest pullback setup, not the best company.', caution: 'The grade does not explain why the price fell. Read it together with Quality.' },
  price: { term: 'Price', short: 'Latest traded price.', detail: 'Latest price in the share’s trading currency. Yahoo Finance data may be delayed.' },
  change: { term: '% today', short: 'Today’s price change.', detail: 'The move since the previous close, in percent.', caution: 'A large daily move does not explain its cause. Check for company news or results.' },
  rsi: { term: 'RSI', short: 'Momentum on a scale from 0 to 100.', detail: 'Measures the balance of gains and losses over fourteen sessions. Below 30 is commonly called oversold and above 70 overbought.', caution: 'Low RSI means the fall has been steep, not that it has ended.' },
  volume: { term: 'Volume', short: 'Turnover versus the 20-day average.', detail: 'Latest trading volume divided by the preceding 20-day average. 2.0x means twice the normal volume.', caution: 'High volume confirms activity, not direction.' },
  pe: { term: 'P/E', short: 'Price divided by earnings per share.', detail: 'How many years of current annual earnings the share price represents.', caution: 'Low does not automatically mean cheap. Compare with history and sector peers.' },
  sma: { term: 'SMA', short: 'Price versus its six-month average.', detail: 'The arrow shows whether price is above or below the 125-session simple moving average.', caution: 'A moving average describes past prices; it is not a forecast.' },
  volatility: { term: 'Volatility', short: 'Annualised historical price variation.', detail: 'Annualised standard deviation based on the latest 20 sessions.', caution: 'This is backward-looking and is not a ceiling for future risk.' },
  beta: { term: 'Beta', short: 'Sensitivity to the market index.', detail: 'How much the share has historically moved when the index moved one percent.', caution: 'Beta measures co-movement, not all company-specific risk.' },
  drawdown: { term: 'Max DD', short: 'Largest decline from a previous peak.', detail: 'The deepest peak-to-trough fall over the measured period.', caution: 'Historical drawdown is not a limit on future losses.' },
  relativeStrength: { term: 'vs index', short: 'Return minus the index over three months.', detail: 'The share’s 63-session return after subtracting the index return.', caution: 'Relative strength can reverse abruptly and says nothing about valuation.' },
  quality: { term: 'Quality', short: 'Company fundamentals, 0 to 10.', detail: 'Combines leverage, return on equity, operating margin, free cash flow and revenue growth.', caution: 'Report data can be several months old and does not replace reading the accounts.' },
  trend: { term: '7d trend', short: 'The latest seven closing prices.', detail: 'A miniature chart showing the direction over the past week.' },
  workspaceOverview: { term: 'Overview', short: 'Balanced default view.', detail: 'Pullback grade, price move, RSI, volume, valuation and trend in one table.' },
  workspaceMomentum: { term: 'Momentum', short: 'Strength of the current move.', detail: 'Daily change, RSI, relative volume, performance versus the index and volatility.', caution: 'Momentum describes what has happened, not what must happen next.' },
  workspaceRisk: { term: 'Risk', short: 'Downside and price variation.', detail: 'Volatility, beta, maximum drawdown and fundamental quality in one view.' },
  workspaceValue: { term: 'Value', short: 'Valuation and quality.', detail: 'Pullback grade, quality, P/E and volume help compare valuation and fundamentals.', caution: 'The cheapest share is often cheap for a reason.' },
  open: { term: 'Open', short: 'The first traded price today.', detail: 'Compare with the previous close to identify an opening gap.' },
  dayHigh: { term: 'High', short: 'Highest price today.', detail: 'The highest traded price in the current session.' },
  dayLow: { term: 'Low', short: 'Lowest price today.', detail: 'The lowest traded price in the current session.' },
  marketCap: { term: 'Market cap', short: 'Total market value of the company.', detail: 'Share price multiplied by shares outstanding. It indicates size, not valuation.' },
  fiftyTwoWeekHigh: { term: '52w high', short: 'Highest price in the past year.', detail: 'A reference level that may act as resistance.' },
  fiftyTwoWeekLow: { term: '52w low', short: 'Lowest price in the past year.', detail: 'A reference level that may act as support, while a break below it signals weakness.' },
  avgVolume: { term: 'Avg volume', short: 'Average turnover over 20 sessions.', detail: 'The benchmark used to assess today’s volume and liquidity.' },
  dividendYield: { term: 'Dividend yield', short: 'Dividend as a percentage of price.', detail: 'Annual dividend divided by the current share price.', caution: 'An unusually high yield may reflect a falling price or an expected dividend cut.' },
  eps: { term: 'EPS', short: 'Earnings per share over twelve months.', detail: 'Profit allocated to each share over the latest four quarters.' },
  priceToBook: { term: 'P/B', short: 'Price versus book equity.', detail: 'Below 1 means the market value is below reported book equity.', caution: 'Most useful for asset-heavy sectors such as banks and real estate.' },
  atr: { term: 'ATR', short: 'Average daily trading range.', detail: 'Average True Range measures a typical daily move including gaps.', caution: 'A stop closer than one ATR is often hit by normal market noise.' },
  earnings: { term: 'Results', short: 'Days until the next quarterly report.', detail: 'Around results, new information can outweigh technical levels.' },
  stopLoss: { term: 'Stop loss', short: 'A mechanical level where the thesis is invalidated.', detail: 'Set using ATR and nearby technical levels.', caution: 'It does not account for gaps, news or liquidity.' },
  target: { term: 'Target', short: 'Nearest technical resistance above price.', detail: 'Uses moving averages, the 52-week high or an ATR-based level.', caution: 'It is a reference level, not an analyst price forecast.' },
  rMultiple: { term: 'R multiple', short: 'Potential reward divided by risk.', detail: 'Distance to target divided by distance to stop. 2R means two units of possible reward per unit at risk.' },
  goldenCross: { term: 'Golden Cross', short: 'SMA 50 crossed above SMA 200.', detail: 'The shorter average has moved above the longer average.', caution: 'Both averages lag the market and do not guarantee a lasting uptrend.' },
  volumeSpike: { term: 'Volume spike', short: 'At least twice normal volume.', detail: 'Unusually many shares have changed hands.', caution: 'The spike does not indicate whether buying or selling dominated.' },
  valueDiscount: { term: 'Lower P/E proxy', short: 'P/E below a price-based 12-month reference.', detail: 'Compares today’s P/E with the median annual price divided by current EPS.', caution: 'This is a proxy, not the company’s true historical P/E series.' },
  earningsSoon: { term: 'Results soon', short: 'Quarterly results within one week.', detail: 'The company is expected to report within seven days.', caution: 'Results can outweigh technical signals.' },
};

export function glossaryEntry(key: GlossaryKey, language: 'sv' | 'en' = 'sv'): GlossaryEntry {
  return language === 'en' ? (GLOSSARY_EN[key] ?? GLOSSARY[key]) : GLOSSARY[key];
}

/** Slås ihop till en rad för skärmläsare och webbläsarens egen hovertext. */
export function glossaryText(key: GlossaryKey, language: 'sv' | 'en' = 'sv') {
  const entry = glossaryEntry(key, language);
  return [entry.short, entry.detail, entry.caution].filter(Boolean).join(' ');
}

/** Kolumn-id i tabellen har samma namn som posterna i ordlistan. */
export const WORKSPACE_GLOSSARY_KEYS: Record<string, GlossaryKey> = {
  overview: 'workspaceOverview',
  momentum: 'workspaceMomentum',
  risk: 'workspaceRisk',
  value: 'workspaceValue',
};
