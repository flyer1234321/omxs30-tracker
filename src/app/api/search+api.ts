import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');

  if (!q) {
    return Response.json({ data: [] });
  }

  try {
    const results = await yahooFinance.search(q);
    const equities = results.quotes
      .filter((q: any) => q.quoteType === 'EQUITY')
      .slice(0, 8)
      .map((q: any) => ({
        symbol: q.symbol,
        shortname: q.shortname,
        exchange: q.exchange,
        quoteType: q.quoteType
      }));

    return Response.json({ data: equities });
  } catch (error) {
    console.error("Search API Error:", error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
