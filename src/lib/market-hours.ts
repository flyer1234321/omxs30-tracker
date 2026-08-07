/**
 * Börstider används på två ställen:
 *  - klienten pollar bara när det finns nya avslut att hämta
 *  - servern håller cachen längre när börsen ändå står still
 *
 * Syftet är att hålla nere antalet anrop mot Yahoo Finance, som är ett
 * inofficiellt och hårt rate-limitat gratis-API.
 */

export type MarketRegion = 'stockholm' | 'us';

interface MarketWindow {
  timeZone: string;
  /** Minuter efter midnatt i börsens egen tidszon. */
  opensAt: number;
  closesAt: number;
}

const MARKET_WINDOWS: Record<MarketRegion, MarketWindow> = {
  stockholm: { timeZone: 'Europe/Stockholm', opensAt: 9 * 60, closesAt: 17 * 60 + 30 },
  us: { timeZone: 'America/New_York', opensAt: 9 * 60 + 30, closesAt: 16 * 60 },
};

export function regionForTicker(ticker: string): MarketRegion {
  return ticker.toUpperCase().endsWith('.ST') ? 'stockholm' : 'us';
}

export function regionForMarket(market: string): MarketRegion {
  return market === 'dji' || market === 'tech' ? 'us' : 'stockholm';
}

interface LocalTime {
  weekday: string;
  minutes: number;
}

function localTime(timeZone: string, at: Date): LocalTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: value('weekday'),
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

/** Minuter sedan midnatt i den angivna tidszonen. */
export function localMinutes(timeZone: string, at = new Date()) {
  return localTime(timeZone, at).minutes;
}

export function isWeekend(timeZone: string, at = new Date()) {
  const { weekday } = localTime(timeZone, at);
  return weekday === 'Sat' || weekday === 'Sun';
}

/**
 * Helgdagar hanteras inte: en gratiskälla för börskalendern saknas. Effekten
 * blir att appen pollar i onödan ett fåtal dagar per år, vilket är ofarligt.
 */
export function isMarketOpen(region: MarketRegion, at = new Date()) {
  const window = MARKET_WINDOWS[region];
  if (isWeekend(window.timeZone, at)) return false;
  const { minutes } = localTime(window.timeZone, at);
  return minutes >= window.opensAt && minutes <= window.closesAt;
}

/** Sant en kort stund efter stängning, så att slutkursen hinner hämtas in. */
export function isJustAfterClose(region: MarketRegion, at = new Date(), graceMinutes = 20) {
  const window = MARKET_WINDOWS[region];
  if (isWeekend(window.timeZone, at)) return false;
  const { minutes } = localTime(window.timeZone, at);
  return minutes > window.closesAt && minutes <= window.closesAt + graceMinutes;
}

/** Datumet i börsens tidszon, som ISO-datum (YYYY-MM-DD). */
export function marketDateString(timeZone: string, at: Date | string | number = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
}

export function timeZoneForRegion(region: MarketRegion) {
  return MARKET_WINDOWS[region].timeZone;
}

/**
 * Hur länge ett svar får återanvändas. Stängd börs ger inga nya avslut, så
 * cachen kan hållas mycket längre då.
 */
export function cacheTtlForRegion(region: MarketRegion, at = new Date()) {
  if (isMarketOpen(region, at)) return 5 * 60 * 1000;
  if (isJustAfterClose(region, at)) return 5 * 60 * 1000;
  return 60 * 60 * 1000;
}

/**
 * En favoritlista kan blanda svenska och amerikanska bolag. Så länge någon av
 * börserna handlar behöver datan vara färsk, så den kortaste livslängden
 * vinner. Utan det här skulle en lista med enbart USA-bolag ha behandlats som
 * stängd hela den amerikanska handelsdagen, eftersom Stockholm redan stängt.
 */
export function cacheTtlForRegions(regions: MarketRegion[], at = new Date()) {
  if (!regions.length) return cacheTtlForRegion('stockholm', at);
  return Math.min(...regions.map((region) => cacheTtlForRegion(region, at)));
}

export function anyMarketOpen(regions: MarketRegion[], at = new Date()) {
  return regions.some((region) => isMarketOpen(region, at));
}

export function anyMarketWorthPolling(regions: MarketRegion[], at = new Date()) {
  return regions.some((region) => isMarketOpen(region, at) || isJustAfterClose(region, at));
}

/** De börser som en uppsättning tickers berör. */
export function regionsForTickers(tickers: string[]): MarketRegion[] {
  return Array.from(new Set(tickers.map(regionForTicker)));
}
