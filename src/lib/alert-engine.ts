import type { HealthCheck } from '@/types/stock';

export type AlertType = 'BUY' | 'SELL';

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
}

export interface StockAlert {
  ticker: string;
  companyName: string;
  price: number;
  type: AlertType;
  reasons: string[];
}

function crossedBelow(price: number, previousClose: number | null, average: number | null, previousAverage: number | null) {
  return previousClose != null && average != null && previousAverage != null
    && previousClose >= previousAverage && price < average;
}

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

  const shortAverage = stock.sma50 ?? stock.sma20;
  const previousShortAverage = stock.previousSma50 ?? stock.previousSma20;
  if ((stock.rsi ?? 0) > 70 && crossedBelow(stock.price, stock.previousClose, shortAverage, previousShortAverage)) {
    sellReasons.push(`RSI ${stock.rsi!.toFixed(0)} och brott ned genom kort trend`);
  }
  if (stock.sma200 != null && stock.price < stock.sma200 && (stock.volumeRatio ?? 0) > 1.3) {
    sellReasons.push('Stänger under SMA200 med hög volym');
  }
  if ((stock.threeDayChangePct ?? 0) > 15 && (stock.rsi ?? 0) > 80) {
    sellReasons.push(`Rusning ${stock.threeDayChangePct!.toFixed(1)} % på tre dagar och RSI ${stock.rsi!.toFixed(0)}`);
  }

  const common = { ticker: stock.ticker, companyName: stock.companyName, price: stock.price };
  // A warning takes precedence over a simultaneous buy condition to avoid contradictory email.
  if (sellReasons.length) return [{ ...common, type: 'SELL', reasons: sellReasons }];
  if (buyReasons.length >= 2) return [{ ...common, type: 'BUY', reasons: buyReasons }];
  return [];
}
