import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const MARKETS: Record<string, string[]> = {
  omxs30: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ASSA-B.ST", "AZN.ST",
    "ATCO-A.ST", "BOL.ST", "EPI-A.ST", "EQT.ST", "ERIC-B.ST",
    "ESSITY-B.ST", "EVO.ST", "HM-B.ST", "HEXA-B.ST", "INDU-C.ST",
    "INVE-B.ST", "LIFCO-B.ST", "NIBE-B.ST", "NDA-SE.ST", "SAND.ST",
    "SCA-B.ST", "SEB-A.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST",
    "SSAB-B.ST", "SWED-A.ST", "TEL2-B.ST", "TELIA.ST", "VOLV-B.ST"
  ],
  dji: [
    "AAPL", "MSFT", "UNH", "JNJ", "V", "PG", "HD", "CVX", "JPM", "MRK", 
    "MCD", "CRM", "CSCO", "KO", "DIS", "WMT", "VZ", "INTC", "NKE", "BA", 
    "IBM", "AMGN", "CAT", "HON", "AXP", "GS", "MMM", "TRV", "DOW", "WBA"
  ]
};

// In-memory cache keyed by request string
let cache: Record<string, { data: any, lastUpdated: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function calculateSMA(history: any[], period: number) {
  if (history.length < period) return null;
  const recent = history.slice(-period);
  const sum = recent.reduce((acc, curr) => acc + curr.close, 0);
  return sum / period;
}

function calculateRSI(history: any[], period = 14) {
  if (history.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < history.length; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function generateSignal(item: any) {
  let score = 0;
  const reasons: string[] = [];
  
  const { currentPrice, sma125, sma200, rsi, fiftyTwoWeekLow } = item;
  
  if (sma125 && currentPrice < sma125) {
    score += 1;
    reasons.push('Kursen ligger under SMA 125 (6-månaderssnittet)');
  }
  
  if (sma200 && currentPrice < sma200) {
    score += 1;
    reasons.push('Kursen ligger under SMA 200 (200-dagarssnittet)');
  }
  
  if (rsi && rsi < 30) {
    score += 2;
    reasons.push('RSI är under 30 (översåld)');
    if (rsi < 20) {
      score += 1;
      reasons.push('RSI är under 20 (kraftigt översåld)');
    }
  }
  
  if (fiftyTwoWeekLow && currentPrice <= fiftyTwoWeekLow * 1.05) {
    score += 1;
    reasons.push('Kursen är inom 5% från 52-veckorslägsta');
  }
  
  let signal: 'KÖP' | 'SÄLJ' | 'NEUTRAL' = 'NEUTRAL';
  
  if (score >= 3) {
    signal = 'KÖP';
  } else if (score >= 1) {
    signal = 'NEUTRAL';
  } else {
    // Check sell conditions
    if (sma125 && sma200 && rsi && currentPrice > sma125 && currentPrice > sma200 && rsi > 70) {
      signal = 'SÄLJ';
      reasons.push('Kursen är över både SMA 125 och SMA 200 samt RSI > 70 (överköpt)');
    }
  }
  
  return { signal, reasons };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = url.searchParams.get('market') || 'omxs30';
  const customTickers = url.searchParams.get('tickers');

  let tickersToFetch: string[] = [];
  if (customTickers) {
    tickersToFetch = customTickers.split(',').map(t => t.trim().toUpperCase());
  } else {
    tickersToFetch = MARKETS[market] || MARKETS['omxs30'];
  }

  const cacheKey = customTickers ? `custom_${customTickers}` : `market_${market}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].lastUpdated < CACHE_TTL) {
    return Response.json({ data: cache[cacheKey].data, cached: true, timestamp: cache[cacheKey].lastUpdated });
  }

  try {
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 12); // 12 months back to ensure 200 trading days

    const results = [];
    const quotes = await yahooFinance.quote(tickersToFetch);
    const quotesMap = new Map();
    quotes.forEach(q => quotesMap.set(q.symbol, q));

    for (const ticker of tickersToFetch) {
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

        const sma125 = calculateSMA(history, 125);
        const sma200 = calculateSMA(history, 200);
        const rsi = calculateRSI(history, 14);
        
        const latestVolume = history[history.length - 1].volume || 0;
        const vol20 = history.slice(-20);
        const avgVolume20 = vol20.reduce((acc, curr) => acc + (curr.volume || 0), 0) / (vol20.length || 1);

        const chartHistory = [];
        const chartHistoryLength = 125;
        const startIndex = Math.max(0, history.length - chartHistoryLength);
        
        for (let i = startIndex; i < history.length; i++) {
            const historyUpToI = history.slice(0, i + 1);
            const sma125AtDay = calculateSMA(historyUpToI, 125);
            chartHistory.push({
                date: history[i].date,
                close: history[i].close,
                sma125: sma125AtDay
            });
        }

        const itemData = {
          ticker,
          companyName,
          currentPrice,
          sma125,
          sma200,
          rsi,
          diffPercent125: sma125 ? ((currentPrice - sma125) / sma125) * 100 : null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow || null,
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh || null,
          trailingPE: quote?.trailingPE || null,
          dividendYield: quote?.dividendYield || null,
          marketCap: quote?.marketCap || null,
          regularMarketChangePercent: quote?.regularMarketChangePercent || null,
          latestVolume,
          avgVolume20,
          chartHistory
        };
        
        const { signal, reasons } = generateSignal(itemData);

        results.push({
          ...itemData,
          signalInfo: { signal, reasons }
        });
      } catch (err) {
        console.error(`Failed to fetch data for ${ticker}:`, err);
      }
    }

    cache[cacheKey] = {
      data: results,
      lastUpdated: Date.now()
    };

    return Response.json({ data: results, cached: false, timestamp: cache[cacheKey].lastUpdated });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
