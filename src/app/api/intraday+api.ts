import YahooFinance from 'yahoo-finance2';
import { isValidTicker, normalizeTicker } from '@/lib/ticker-validation';
import { requireAuthenticatedUser } from '@/lib/app-auth';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

interface IntradayQuote {
  date: Date | string;
  close: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

interface ChartResponse {
  quotes?: IntradayQuote[];
}

export async function GET(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  const url = new URL(request.url);
  const tickerParam = url.searchParams.get('ticker');
  const range = url.searchParams.get('range') || '1d'; // '1d' or '5d'

  if (!tickerParam) {
    return Response.json({ error: 'Ticker is required' }, { status: 400 });
  }
  if (range !== '1d' && range !== '5d') {
    return Response.json({ error: 'Range must be 1d or 5d' }, { status: 400 });
  }

  const ticker = normalizeTicker(tickerParam);
  if (!isValidTicker(ticker)) {
    return Response.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  try {
    const interval = range === '1d' ? '5m' : '15m';
    
    // YahooFinance v2 requires period1 instead of range
    // Request a few extra days to account for weekends/holidays
    const daysToFetch = range === '1d' ? 5 : 10; 
    const period1 = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);
    
    const chartData = await yahooFinance.chart(ticker, {
      period1,
      interval,
    }, { validateResult: false }) as ChartResponse;

    if (!chartData.quotes || chartData.quotes.length === 0) {
      return Response.json({ data: [] });
    }

    // Filter to only the last 1 day or 5 days of trading
    const validQuotes = chartData.quotes.filter((q): q is IntradayQuote & { close: number } => q.close !== null);
    if (validQuotes.length === 0) return Response.json({ data: [] });
    
    const lastDate = new Date(validQuotes[validQuotes.length - 1].date);
    
    let history: (IntradayQuote & { close: number })[] = [];
    if (range === '1d') {
      const lastDayString = lastDate.toISOString().split('T')[0];
      history = validQuotes.filter(q => new Date(q.date).toISOString().startsWith(lastDayString));
    } else {
      const fiveDaysAgo = new Date(lastDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      history = validQuotes.filter(q => new Date(q.date) >= fiveDaysAgo);
    }

    const data = history.map(q => ({
      date: q.date,
      close: q.close,
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      volume: q.volume ?? null,
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("Intraday API Error:", error);
    return Response.json({ error: 'Failed to fetch intraday data' }, { status: 500 });
  }
}
