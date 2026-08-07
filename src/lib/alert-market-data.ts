import YahooFinance from 'yahoo-finance2';
import { calculateBollingerBands, calculateMACD, calculateRSI, calculateSMA, calculateVolatility, type PricePoint } from '@/lib/indicators';
import { generateHealthCheck } from '@/lib/stock-health';
import type { AlertSnapshot } from '@/lib/alert-engine';

interface ChartPoint extends PricePoint { date: Date | string; }
interface Quote { symbol: string; regularMarketPrice?: number; longName?: string; shortName?: string; fiftyTwoWeekLow?: number; fiftyTwoWeekHigh?: number; trailingPE?: number; dividendYield?: number; }

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'], validation: { logErrors: false } });

function percentChange(current: number, previous: number | undefined) {
  return previous && previous > 0 ? ((current - previous) / previous) * 100 : null;
}

async function loadOne(ticker: string): Promise<AlertSnapshot | null> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 1);
    const [quote, chart] = await Promise.all([
      yahooFinance.quote(ticker, {}, { validateResult: false }) as Promise<Quote>,
      yahooFinance.chart(ticker, { period1, interval: '1d' }, { validateResult: false }) as Promise<{ quotes?: ChartPoint[] }>,
    ]);
    const history = (chart.quotes || []).filter((point): point is ChartPoint => Number.isFinite(point.close) && point.close > 0);
    const price = quote?.regularMarketPrice;
    if (!price || history.length < 21) return null;

    const previousHistory = history.slice(0, -1);
    const previous20 = history.slice(-21, -1);
    const latest = history.at(-1)!;
    const averageVolume = previous20.reduce((sum, point) => sum + (point.volume || 0), 0) / Math.max(previous20.length, 1);
    const health = generateHealthCheck({
      currentPrice: price,
      sma125: calculateSMA(history, 125),
      rsi: calculateRSI(history, 14),
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
      trailingPE: quote.trailingPE ?? null,
      dividendYield: quote.dividendYield ?? null,
      bollingerBands: calculateBollingerBands(history, 20, 2),
      macdData: calculateMACD(history),
      volatility: calculateVolatility(history, 20),
      companyName: quote.longName || quote.shortName || ticker,
    });

    return {
      ticker,
      companyName: quote.longName || quote.shortName || ticker,
      price,
      previousClose: previousHistory.at(-1)?.close ?? null,
      rsi: calculateRSI(history, 14),
      previousRsi: calculateRSI(previousHistory, 14),
      sma20: calculateSMA(history, 20),
      previousSma20: calculateSMA(previousHistory, 20),
      sma50: calculateSMA(history, 50),
      previousSma50: calculateSMA(previousHistory, 50),
      sma200: calculateSMA(history, 200),
      previousSma200: calculateSMA(previousHistory, 200),
      volumeRatio: averageVolume > 0 ? (latest.volume || 0) / averageVolume : null,
      weeklyChangePct: percentChange(price, history.at(-8)?.close),
      threeDayChangePct: percentChange(price, history.at(-4)?.close),
      grade: health.grade,
    };
  } catch (error) {
    console.error(`Alert market data failed for ${ticker}:`, error);
    return null;
  }
}

export async function loadAlertSnapshots(tickers: string[]) {
  const unique = [...new Set(tickers)].slice(0, 120);
  const snapshots = new Map<string, AlertSnapshot>();
  for (let index = 0; index < unique.length; index += 5) {
    const batch = await Promise.all(unique.slice(index, index + 5).map(loadOne));
    batch.filter((snapshot): snapshot is AlertSnapshot => snapshot !== null).forEach((snapshot) => snapshots.set(snapshot.ticker, snapshot));
  }
  return snapshots;
}
