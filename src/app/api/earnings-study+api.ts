import { requireAuthenticatedUser, requireAdminUser } from '@/lib/app-auth';
import { aggregateEvents, runEarningsStudy, type EarningsStudy } from '@/lib/earnings-events';
import { BENCHMARKS, MARKETS } from '@/lib/markets';
import { isValidTicker, normalizeTicker } from '@/lib/ticker-validation';

/**
 * Rapporthistorik ändras bara fyra gånger om året per bolag, så resultatet
 * cachas länge. Studien är dessutom tung: två anrop per bolag mot ett
 * gratis-API som stryper trafik.
 */
const CACHE_TTL = 12 * 60 * 60 * 1000;
const cache = new Map<string, { study: EarningsStudy; cachedAt: number }>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedTicker = url.searchParams.get('ticker');
  const market = url.searchParams.get('market');

  // Enskilt bolag är billigt och används i detaljvyn. Hela urvalet är dyrt och
  // är därför förbehållet administratörer.
  if (requestedTicker) {
    const authenticationError = await requireAuthenticatedUser(request);
    if (authenticationError) return authenticationError;

    const ticker = normalizeTicker(requestedTicker);
    if (!isValidTicker(ticker)) return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });

    const cacheKey = `ticker_${ticker}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return Response.json({ study: cached.study, cached: true });
    }

    const benchmark = ticker.endsWith('.ST') ? '^OMX' : '^GSPC';
    const study = await runEarningsStudy([ticker], benchmark);
    cache.set(cacheKey, { study, cachedAt: Date.now() });
    return Response.json({ study, cached: false });
  }

  const { error } = await requireAdminUser(request);
  if (error) return error;

  const marketKey = market && MARKETS[market] ? market : 'omxs30';
  const cacheKey = `market_${marketKey}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return Response.json({ study: cached.study, cached: true, market: marketKey });
  }

  const study = await runEarningsStudy(MARKETS[marketKey], BENCHMARKS[marketKey] || '^OMX');
  cache.set(cacheKey, { study, cachedAt: Date.now() });
  return Response.json({ study, cached: false, market: marketKey });
}

/** Låter admin räkna om utan att vänta ut cachen. */
export async function POST(request: Request) {
  const { error } = await requireAdminUser(request);
  if (error) return error;

  const url = new URL(request.url);
  const market = url.searchParams.get('market');
  const marketKey = market && MARKETS[market] ? market : 'omxs30';

  const study = await runEarningsStudy(MARKETS[marketKey], BENCHMARKS[marketKey] || '^OMX');
  cache.set(`market_${marketKey}`, { study, cachedAt: Date.now() });
  return Response.json({ study, cached: false, market: marketKey, buckets: aggregateEvents(study.events).length });
}
