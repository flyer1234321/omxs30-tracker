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
    
    const chartData = await yahooFinance.chart(ticker, {
      range: range as any,
      interval: interval as any,
    }, { validateResult: false });

    const history = chartData.quotes.filter(q => q.close !== null).map(q => ({
      date: q.date,
      close: q.close
    }));

    return Response.json({ data: history });
  } catch (error) {
    console.error("Intraday API Error:", error);
    return Response.json({ error: 'Failed to fetch intraday data' }, { status: 500 });
  }
}
