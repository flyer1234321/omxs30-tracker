import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const OMXS30_TICKERS = [
  "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ASSA-B.ST", "AZN.ST",
  "ATCO-A.ST", "BOL.ST", "EPI-A.ST", "EQT.ST", "ERIC-B.ST",
  "ESSITY-B.ST", "EVO.ST", "HM-B.ST", "HEXA-B.ST", "INDU-C.ST",
  "INVE-B.ST", "LIFCO-B.ST", "NIBE-B.ST", "NDA-SE.ST", "SAND.ST",
  "SCA-B.ST", "SEB-A.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST",
  "SSAB-B.ST", "SWED-A.ST", "TEL2-B.ST", "TELIA.ST", "VOLV-B.ST"
];

// Simple in-memory cache
let cache = {
  data: null,
  lastUpdated: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  if (cache.data && Date.now() - cache.lastUpdated < CACHE_TTL) {
    return Response.json({ data: cache.data, cached: true, timestamp: cache.lastUpdated });
  }

  try {
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 8); // Go back 8 months to ensure at least 125 trading days
    
    // Process tickers sequentially or in smaller chunks to avoid rate limiting
    const results = [];
    
    // To speed up, we fetch the live quote for all of them at once!
    const quotes = await yahooFinance.quote(OMXS30_TICKERS);
    const quotesMap = new Map();
    quotes.forEach(q => quotesMap.set(q.symbol, q));

    for (const ticker of OMXS30_TICKERS) {
      try {
        const chartData = await yahooFinance.chart(ticker, {
          period1,
          interval: '1d',
        });

        const quote = quotesMap.get(ticker);
        const currentPrice = quote?.regularMarketPrice;
        const companyName = quote?.longName || quote?.shortName || ticker;

        const history = chartData.quotes;

        if (!history || history.length === 0 || !currentPrice) {
          continue;
        }

        // Get last 125 trading days
        const recentHistory = history.slice(-125);
        if (recentHistory.length === 0) continue;
        
        const sum = recentHistory.reduce((acc, curr) => acc + curr.close, 0);
        const sma125 = sum / recentHistory.length;

        if (currentPrice < sma125) {
           const diffPercent = ((currentPrice - sma125) / sma125) * 100;
           results.push({
              ticker,
              companyName,
              currentPrice,
              sma125,
              diffPercent
           });
        }
      } catch (err) {
        console.error(`Failed to fetch data for ${ticker}:`, err);
      }
    }

    // Sort by largest negative deviation (most negative first)
    results.sort((a, b) => a.diffPercent - b.diffPercent);
    
    cache.data = results;
    cache.lastUpdated = Date.now();

    return Response.json({ data: results, cached: false, timestamp: cache.lastUpdated });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
