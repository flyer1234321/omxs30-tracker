import type { HealthCheck } from '@/types/stock';

export type AlertType = 'BUY' | 'SELL';
export type AlertUrgency = 'STANDARD' | 'URGENT';

export interface AlertSnapshot {
  ticker: string;
  companyName: string;
  price: number;
  previousClose: number | null;
  rsi: number | null;
  previousRsi: number | null;
  sma20: number | null;
  previousSma20: number | null;
  sma50: number | null;
  previousSma50: number | null;
  sma200: number | null;
  previousSma200: number | null;
  volumeRatio: number | null;
  weeklyChangePct: number | null;
  threeDayChangePct: number | null;
  grade: HealthCheck['grade'] | null;
  /** Dagar till nasta rapport, om Yahoo har ett datum. */
  earningsInDays?: number | null;
}

export interface StockAlert {
  ticker: string;
  companyName: string;
  price: number;
  type: AlertType;
  urgency: AlertUrgency;
  reasons: string[];
}

function crossedBelow(price: number, previousClose: number | null, average: number | null, previousAverage: number | null) {
  return previousClose != null && average != null && previousAverage != null
    && previousClose >= previousAverage && price < average;
}

function crossedAbove(price: number, previousClose: number | null, average: number | null, previousAverage: number | null) {
  return previousClose != null && average != null && previousAverage != null
    && previousClose <= previousAverage && price > average;
}

/**
 * En rapport gor tekniska nivaer mindre anvandbara: kursen styrs av innehallet
 * i rapporten. Larmet skickas anda, men med en tydlig brasklapp.
 */
const EARNINGS_CAUTION_DAYS = 3;

export function evaluateAlerts(stock: AlertSnapshot): StockAlert[] {
  const buyReasons: string[] = [];
  const sellReasons: string[] = [];
  const rsiBounce = stock.rsi != null && (
    stock.rsi < 30 || (stock.previousRsi != null && stock.previousRsi < 30 && stock.rsi >= 30)
  );
  if (rsiBounce) buyReasons.push(`RSI ${stock.rsi!.toFixed(0)}: översåld eller åter över 30`);

  const nearSma200 = stock.sma200 != null
    && Math.abs((stock.price - stock.sma200) / stock.sma200) <= 0.015
    && (stock.volumeRatio ?? 0) >= 0.8;
  if (nearSma200) buyReasons.push('Kurs nära SMA200 med normal eller hög volym');

  if (stock.grade === 'A' && (stock.weeklyChangePct ?? 0) <= -5) {
    buyReasons.push(`A-betyg efter tillfällig dipp (${stock.weeklyChangePct!.toFixed(1)} % på 7 dagar)`);
  }

  // Tre kopvillkor och ett krav pa minst tva av dem gjorde kopsignaler
  // nastan omojliga i praktiken. Har ar tre villkor till, alla speglingar av
  // saljlogiken nedan.
  const shortAverageForBuy = stock.sma50 ?? stock.sma20;
  const previousShortAverageForBuy = stock.previousSma50 ?? stock.previousSma20;
  if (crossedAbove(stock.price, stock.previousClose, shortAverageForBuy, previousShortAverageForBuy)) {
    buyReasons.push('Kursen tog sig upp genom sin korta trend');
  }
  if (crossedAbove(stock.price, stock.previousClose, stock.sma200, stock.previousSma200)) {
    buyReasons.push('Kursen stängde över SMA200 efter att ha legat under');
  }
  if (
    stock.sma50 != null && stock.sma200 != null && stock.previousSma50 != null && stock.previousSma200 != null
    && stock.sma50 > stock.sma200 && stock.previousSma50 <= stock.previousSma200
  ) {
    buyReasons.push('SMA50 korsade upp genom SMA200');
  }
  if ((stock.grade === 'A' || stock.grade === 'B') && (stock.rsi ?? 100) < 40) {
    buyReasons.push(`Betyg ${stock.grade} med RSI ${stock.rsi!.toFixed(0)}`);
  }

  const shortAverage = stock.sma50 ?? stock.sma20;
  const previousShortAverage = stock.previousSma50 ?? stock.previousSma20;
  if ((stock.rsi ?? 0) > 70 && crossedBelow(stock.price, stock.previousClose, shortAverage, previousShortAverage)) {
    sellReasons.push(`RSI ${stock.rsi!.toFixed(0)} och brott ned genom kort trend`);
  }
  const breaksSma200WithVolume = stock.sma200 != null && stock.price < stock.sma200 && (stock.volumeRatio ?? 0) > 1.3;
  if (breaksSma200WithVolume) {
    sellReasons.push('Stänger under SMA200 med hög volym');
  }
  const extremeRun = (stock.threeDayChangePct ?? 0) > 15 && (stock.rsi ?? 0) > 80;
  if (extremeRun) {
    sellReasons.push(`Rusning ${stock.threeDayChangePct!.toFixed(1)} % på tre dagar och RSI ${stock.rsi!.toFixed(0)}`);
  }
  const sharpDrop = stock.previousClose != null && stock.previousClose > 0
    && ((stock.price - stock.previousClose) / stock.previousClose) <= -0.07
    && (stock.volumeRatio ?? 0) > 1.3;
  if (sharpDrop) sellReasons.push('Fall över 7 % från föregående stängning med hög volym');

  const common = { ticker: stock.ticker, companyName: stock.companyName, price: stock.price };
  const earningsNote = stock.earningsInDays != null && stock.earningsInDays >= 0 && stock.earningsInDays <= EARNINGS_CAUTION_DAYS
    ? stock.earningsInDays === 0
      ? 'Obs: bolaget rapporterar i dag'
      : `Obs: rapport om ${stock.earningsInDays} ${stock.earningsInDays === 1 ? 'dag' : 'dagar'}`
    : null;
  const withNote = (reasons: string[]) => (earningsNote ? [...reasons, earningsNote] : reasons);

  // A warning takes precedence over a simultaneous buy condition to avoid contradictory email.
  if (sellReasons.length) return [{ ...common, type: 'SELL', urgency: breaksSma200WithVolume || extremeRun || sellReasons.length >= 2 ? 'URGENT' : 'STANDARD', reasons: withNote(sellReasons) }];
  if (buyReasons.length >= 2) return [{ ...common, type: 'BUY', urgency: buyReasons.length >= 3 ? 'URGENT' : 'STANDARD', reasons: withNote(buyReasons) }];
  return [];
}

export function isUrgentLiveAlert(alert: StockAlert) {
  return alert.urgency === 'URGENT';
}
