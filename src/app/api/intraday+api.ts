import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker');
  const range = url.searchParams.get('range') || '1d'; // '1d' or '5d'

  if (!ticker) {
    return Response.json({ error: 'Ticker is required' }, { status: 400 });
  }

  try {
    const interval = range === '1d' ? '5m' : '15m';
    
    // YahooFinance v2 requires period1 instead of range
    // Request a few extra days to account for weekends/holidays
    const daysToFetch = range === '1d' ? 5 : 10; 
    const period1 = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000);
    
    const chartData = await yahooFinance.chart(ticker, {
      period1,
      interval: interval as any,
    }, { validateResult: false });

    if (!chartData.quotes || chartData.quotes.length === 0) {
      return Response.json({ data: [] });
    }

    // Filter to only the last 1 day or 5 days of trading
    const validQuotes = chartData.quotes.filter(q => q.close !== null);
    if (validQuotes.length === 0) return Response.json({ data: [] });
    
    const lastDate = new Date(validQuotes[validQuotes.length - 1].date);
    
    let history = [];
    if (range === '1d') {
      const lastDayString = lastDate.toISOString().split('T')[0];
      history = validQuotes.filter(q => new Date(q.date).toISOString().startsWith(lastDayString));
    } else {
      const fiveDaysAgo = new Date(lastDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      history = validQuotes.filter(q => new Date(q.date) >= fiveDaysAgo);
    }

    history = history.map(q => ({
      date: q.date,
      close: q.close
    }));

    return Response.json({ data: history });
  } catch (error) {
    console.error("Intraday API Error:", error);
    return Response.json({ error: 'Failed to fetch intraday data' }, { status: 500 });
  }
}
