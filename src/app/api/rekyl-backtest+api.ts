import YahooFinance from 'yahoo-finance2';
import { requireAdminUser } from '@/lib/app-auth';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BENCHMARKS, MARKETS } from '@/lib/markets';
import {
  aggregateObservations,
  collectObservations,
  type RekylBacktest,
  type RekylObservation,
} from '@/lib/rekyl-backtest';
import type { EventPricePoint } from '@/lib/event-study';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

/**
 * Tio års dagskurser för ett helt marknadsurval är det tyngsta appen gör.
 * Resultatet ändras knappt från dag till dag, så det cachas ett halvt dygn.
 */
const CACHE_TTL = 12 * 60 * 60 * 1000;
const cache = new Map<string, { result: RekylBacktest; cachedAt: number }>();

interface ChartResponse {
  quotes?: { date: Date | string; close: number | null; volume?: number | null }[];
}

async function loadHistory(ticker: string, period1: Date): Promise<EventPricePoint[]> {
  try {
    const chart = await yahooFinance.chart(ticker, { period1, interval: '1d' }, { validateResult: false }) as ChartResponse;
    return (chart.quotes || [])
      .filter((quote): quote is { date: Date | string; close: number; volume?: number | null } => quote.close != null)
      .map((quote) => ({ date: new Date(quote.date).toISOString(), close: quote.close, volume: quote.volume ?? null }));
  } catch (error) {
    console.error(`Rekyl backtest could not load ${ticker}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  const url = new URL(request.url);
  const requestedMarket = url.searchParams.get('market');
  const market = requestedMarket && MARKETS[requestedMarket] ? requestedMarket : 'omxs30';
  const years = Math.min(Math.max(Number(url.searchParams.get('years')) || 10, 2), 15);
  const cacheKey = `${market}:${years}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return Response.json({ result: cached.result, cached: true, market });
  }

  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - years);

  const benchmark = await loadHistory(BENCHMARKS[market] || '^OMX', period1);
  if (!benchmark.length) {
    return Response.json({ error: 'Jämförelseindex kunde inte hämtas, och utan det går ingen överavkastning att räkna.' }, { status: 502 });
  }

  const tickers = MARKETS[market];
  const perTicker = await mapWithConcurrency(tickers, 5, async (ticker) => {
    const history = await loadHistory(ticker, period1);
    // Under tre års data blir de rullande fönstren för korta för att ge något.
    if (history.length < 750) return [] as RekylObservation[];
    return collectObservations(history, benchmark);
  });

  const observations = perTicker.flat();
  const withData = perTicker.filter((list) => list.length > 0).length;
  const result = aggregateObservations(observations, withData);

  cache.set(cacheKey, { result, cachedAt: Date.now() });
  return Response.json({ result, cached: false, market, years });
}
