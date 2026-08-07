import YahooFinance from 'yahoo-finance2';
import { isValidTicker, normalizeTicker } from '@/lib/ticker-validation';
import { requireAuthenticatedUser } from '@/lib/app-auth';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

const historyRanges = ['1mo', '3mo', '6mo', 'ytd', '1y', '2y', '5y', '10y', 'max'] as const;
type HistoryRange = typeof historyRanges[number];

interface HistoryQuote {
  date: Date | string;
  close: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

interface ChartResponse {
  quotes?: HistoryQuote[];
}

const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map<string, { data: unknown; cachedAt: number }>();

function periodStart(range: HistoryRange) {
  const start = new Date();
  switch (range) {
    case '1mo': start.setMonth(start.getMonth() - 1); break;
    case '3mo': start.setMonth(start.getMonth() - 3); break;
    case '6mo': start.setMonth(start.getMonth() - 6); break;
    case 'ytd': start.setMonth(0, 1); break;
    case '1y': start.setFullYear(start.getFullYear() - 1); break;
    case '2y': start.setFullYear(start.getFullYear() - 2); break;
    case '5y': start.setFullYear(start.getFullYear() - 5); break;
    case '10y': start.setFullYear(start.getFullYear() - 10); break;
    case 'max': return new Date('1985-01-01T00:00:00.000Z');
  }
  return start;
}

export async function GET(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  const url = new URL(request.url);
  const requestedTicker = url.searchParams.get('ticker');
  const requestedRange = url.searchParams.get('range') || '1y';

  if (!requestedTicker) return Response.json({ error: 'Ticker is required' }, { status: 400 });
  if (!historyRanges.includes(requestedRange as HistoryRange)) {
    return Response.json({ error: 'Unsupported history range' }, { status: 400 });
  }

  const ticker = normalizeTicker(requestedTicker);
  if (!isValidTicker(ticker)) return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });

  const range = requestedRange as HistoryRange;
  const cacheKey = `${ticker}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return Response.json({ data: cached.data, cached: true });
  }

  try {
    const result = await yahooFinance.chart(ticker, {
      period1: periodStart(range),
      interval: '1d',
    }, { validateResult: false }) as ChartResponse;

    const data = (result.quotes || [])
      .filter((quote): quote is HistoryQuote & { close: number } => quote.close != null)
      .map((quote) => ({
        date: new Date(quote.date).toISOString(),
        close: quote.close,
        open: quote.open ?? null,
        high: quote.high ?? null,
        low: quote.low ?? null,
        volume: quote.volume ?? null,
      }));

    cache.set(cacheKey, { data, cachedAt: Date.now() });
    return Response.json({ data, cached: false });
  } catch (error) {
    console.error('History API Error:', error);
    return Response.json({ error: 'Failed to fetch price history' }, { status: 500 });
  }
}
