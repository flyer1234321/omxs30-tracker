import YahooFinance from 'yahoo-finance2';
import {
  calculateBollingerBands,
  calculateMACD,
  calculateBeta,
  calculateMaxDrawdown,
  calculateRSI,
  calculateSMA,
  calculateVolatility,
  type PricePoint,
} from '@/lib/indicators';
import { deriveStockSignals } from '@/lib/stock-signals';
import { parseTickerList } from '@/lib/ticker-validation';
import type { StockData } from '@/types/stock';
import { requireAuthenticatedUser } from '@/lib/app-auth';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

interface ChartQuote extends PricePoint {
  date: Date | string;
}

interface ChartResponse {
  quotes?: ChartQuote[];
}

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  longName?: string;
  shortName?: string;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  trailingPE?: number;
  dividendYield?: number;
  marketCap?: number;
  regularMarketChangePercent?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  epsTrailingTwelveMonths?: number;
  earningsTimestamp?: number;
  priceToBook?: number;
  bookValue?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
}

const MARKETS: Record<string, string[]> = {
  omxs30: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ASSA-B.ST", "AZN.ST",
    "ATCO-A.ST", "BOL.ST", "EPI-A.ST", "EQT.ST", "ERIC-B.ST",
    "ESSITY-B.ST", "EVO.ST", "HM-B.ST", "HEXA-B.ST", "INDU-C.ST",
    "INVE-B.ST", "LIFCO-B.ST", "NIBE-B.ST", "NDA-SE.ST", "SAND.ST",
    "SCA-B.ST", "SEB-A.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST",
    "SSAB-B.ST", "SWED-A.ST", "TEL2-B.ST", "TELIA.ST", "VOLV-B.ST"
  ],
  swe_broad: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ARPL.ST", "ASSA-B.ST", "ATCO-A.ST", "ATCO-B.ST", "ATRLJ-B.ST",
    "AXFO.ST", "AZN.ST", "BALD-B.ST", "BOL.ST", "CASTE.ST", "CIBUS.ST", "DIOS.ST", "ELUX-B.ST",
    "EPI-A.ST", "EQT.ST", "ERIC-B.ST", "ESSITY-B.ST", "EVO.ST", "FABG.ST", "GETI-B.ST", "HEXA-B.ST",
    "HM-B.ST", "HUFV-A.ST", "INDU-C.ST", "INVE-A.ST", "INVE-B.ST", "KINV-B.ST", "LIFCO-B.ST", "LUND-B.ST",
    "NDA-SE.ST", "NIBE-B.ST", "NP3.ST", "OEM-B.ST", "PEAB-B.ST", "SAAB-B.ST", "SAND.ST", "SBB-B.ST",
    "SCA-B.ST", "SEB-A.ST", "SECU-B.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST", "SSAB-B.ST", "SWED-A.ST",
    "TEL2-B.ST", "TELIA.ST", "TREL-B.ST", "TRUE-B.ST", "VOLV-A.ST", "VOLV-B.ST", "WIHL.ST", "XANO-B.ST"
  ],
  dji: [
    "AAPL", "MSFT", "UNH", "JNJ", "V", "PG", "HD", "CVX", "JPM", "MRK", 
    "MCD", "CRM", "CSCO", "KO", "DIS", "WMT", "VZ", "INTC", "NKE", "BA", 
    "IBM", "AMGN", "CAT", "HON", "AXP", "GS", "MMM", "TRV", "DOW", "WBA"
  ],
  tech: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AVGO",
    "NFLX", "AMD", "QCOM", "ADBE", "CRM", "INTC", "CSCO"
  ],
  swe_fastigheter: [
    "SBB-B.ST", "BALD-B.ST", "CASTE.ST", "NYF.ST", "FABG.ST",
    "WALL-B.ST", "NP3.ST", "HUFV-A.ST", "CORE-B.ST", "DIOS.ST",
    "CIBUS.ST", "HEBA-B.ST", "KFAST-B.ST", "CATENA.ST", "ATRLJ-B.ST"
  ]
};

const BENCHMARKS: Record<string, string> = {
  omxs30: '^OMX',
  swe_broad: '^OMX',
  swe_fastigheter: '^OMX',
  dji: '^DJI',
  tech: '^IXIC',
  watchlist: '^OMX',
};

function benchmarkForTicker(ticker: string, market: string, isCustomRequest: boolean) {
  if (isCustomRequest) return ticker.endsWith('.ST') ? '^OMX' : '^GSPC';
  return BENCHMARKS[market] || BENCHMARKS.omxs30;
}

// In-memory cache keyed by normalized request string.
let cache: Record<string, { data: unknown, lastUpdated: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function generateHealthCheck(item: {
  currentPrice: number;
  sma125: number | null;
  rsi: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  bollingerBands: ReturnType<typeof calculateBollingerBands>;
  macdData: ReturnType<typeof calculateMACD>;
  volatility: number | null;
  companyName: string;
}) {
  let gradeScore = 0;
  const checklist = [];
  
  const { currentPrice, sma125, rsi, fiftyTwoWeekLow, fiftyTwoWeekHigh, trailingPE, dividendYield, bollingerBands, macdData, volatility, companyName } = item;
  
  const pePassed = trailingPE !== null && trailingPE > 0;
  checklist.push({ label: 'Tjänar företaget pengar?', passed: pePassed, detail: pePassed ? `P/E: ${trailingPE.toFixed(1)}` : 'Negativt/Saknas' });
  if (pePassed) gradeScore += 1;
  
  const divPassed = dividendYield !== null && dividendYield > 0;
  checklist.push({ label: 'Betalar utdelning?', passed: divPassed, detail: divPassed ? `Direktavkastning: ${(dividendYield * 100).toFixed(1)}%` : 'Ingen utdelning' });
  if (divPassed) gradeScore += 1;
  
  let dropVal = 0;
  if (fiftyTwoWeekHigh) {
    dropVal = ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100;
  } else if (sma125) {
    dropVal = ((sma125 - currentPrice) / sma125) * 100;
  }
  const dropPassed = dropVal > 8;
  checklist.push({ label: 'Har aktien fallit kraftigt?', passed: dropPassed, detail: `Faller ${dropVal.toFixed(1)}%` });
  if (dropPassed) gradeScore += 1;
  
  const nearLowPassed = fiftyTwoWeekLow ? ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10 : false;
  checklist.push({ label: 'Nära botten?', passed: nearLowPassed, detail: fiftyTwoWeekLow ? `${(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow)*100).toFixed(1)}% från botten` : 'N/A' });
  if (nearLowPassed) gradeScore += 1;
  
  const rsiPassed = rsi !== null && rsi < 35;
  checklist.push({ label: 'Översåld (RSI)?', passed: rsiPassed, detail: rsi ? `RSI: ${rsi.toFixed(1)}` : 'N/A' });
  if (rsiPassed) gradeScore += 1;
  
  const smaPassed = sma125 !== null && currentPrice < sma125;
  const smaDiff = sma125 ? ((sma125 - currentPrice) / sma125) * 100 : 0;
  checklist.push({ label: 'Under glidande medelvärde?', passed: smaPassed, detail: smaPassed ? `${smaDiff.toFixed(1)}% under` : 'Över SMA' });
  if (smaPassed) gradeScore += 1;
  
  if (rsi !== null && rsi < 20) gradeScore += 1;
  
  const nearLowerBB = bollingerBands && currentPrice <= bollingerBands.lower * 1.01;
  if (nearLowerBB) gradeScore += 1;
  
  if (macdData && macdData.trend === 'up') gradeScore += 1;
  
  const passedItems = checklist.filter(c => c.passed).length;
  
  let grade: 'A'|'B'|'C'|'D'|'F' = 'F';
  if ((gradeScore >= 7 || (passedItems >= 5 && rsi !== null && rsi < 30)) && pePassed && divPassed) {
    grade = 'A';
  } else if (gradeScore >= 5) {
    grade = 'B';
  } else if (gradeScore >= 3) {
    grade = 'C';
  } else if (gradeScore >= 1) {
    grade = 'D';
  } else {
    grade = 'F';
  }
  
  let riskLevel: 'Låg' | 'Medel' | 'Hög' = 'Låg';
  if (volatility !== null) {
    if (volatility > 40) riskLevel = 'Hög';
    else if (volatility > 25) riskLevel = 'Medel';
  }
  
  const momentum: 'Uppåt' | 'Nedåt' | 'Sidledes' = macdData
    ? (macdData.trend === 'up' ? 'Uppåt' : (macdData.trend === 'down' ? 'Nedåt' : 'Sidledes'))
    : 'Sidledes';
  
  const diffPct = sma125 ? Math.abs(((currentPrice - sma125) / sma125) * 100).toFixed(1) : '0.0';
  const priceAction = sma125 ? (currentPrice < sma125 ? `handlas ${diffPct}% under` : `handlas ${diffPct}% över`) + ' sitt 6-månaderssnitt' : 'handlas nära sitt snitt';
  const rsiText = (rsi !== null && rsi < 30) ? ` och RSI ligger på ${rsi.toFixed(0)} (översåld)` : '';
  const divText = dividendYield ? `. Direktavkastningen är ${(dividendYield * 100).toFixed(1)}%` : '';
  const lowText = (fiftyTwoWeekLow && ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10) ? `. ${( ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100 ).toFixed(1)}% från 52v-lägsta` : '';

  let summary = `${companyName} ${priceAction}${rsiText}${divText}${lowText}. Risken bedöms som ${riskLevel.toLowerCase()}.`;
  if (grade === 'A' || grade === 'B') {
    summary += ' Övergripande visar aktien flera tecken på köpläge.';
  } else if (grade === 'C') {
    summary += ' Övergripande är aktien i ett neutralt läge.';
  } else {
    summary += ' Inga tydliga köpsignaler för tillfället.';
  }
  
  return { grade, gradeScore, summary, riskLevel, momentum, checklist };
}

function calculateRiskRewardScore(item: {
  currentPrice: number;
  sma50: number | null;
  sma125: number | null;
  volatility: number | null;
  healthCheck: { gradeScore: number };
}) {
  if (item.volatility == null) return null;

  let score = 0;
  if (item.volatility <= 20) score += 40;
  else if (item.volatility <= 30) score += 28;
  else if (item.volatility <= 40) score += 15;

  if (item.sma50 != null && item.currentPrice > item.sma50) score += 20;
  if (item.sma125 != null && item.currentPrice > item.sma125) score += 20;
  score += Math.min(item.healthCheck.gradeScore, 10) * 2;

  return Math.min(score, 100);
}

export async function GET(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  const url = new URL(request.url);
  const market = url.searchParams.get('market') || 'omxs30';
  const customTickers = url.searchParams.get('tickers');

  let tickersToFetch: string[] = [];
  let cacheKey = `market_${market}`;
  if (customTickers) {
    const parsed = parseTickerList(customTickers);
    if (parsed.invalid.length > 0) {
      return Response.json({ error: `Invalid ticker symbol: ${parsed.invalid[0]}` }, { status: 400 });
    }
    if (parsed.tooMany) {
      return Response.json({ error: 'Too many tickers. Maximum is 60.' }, { status: 400 });
    }
    if (parsed.tickers.length === 0) {
      return Response.json({ error: 'At least one ticker is required' }, { status: 400 });
    }
    tickersToFetch = parsed.tickers;
    cacheKey = `custom_${tickersToFetch.join(',')}`;
  } else {
    tickersToFetch = MARKETS[market] || MARKETS['omxs30'];
  }

  if (cache[cacheKey] && Date.now() - cache[cacheKey].lastUpdated < CACHE_TTL) {
    return Response.json({ data: cache[cacheKey].data, cached: true, timestamp: cache[cacheKey].lastUpdated });
  }

  try {
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 18); // 18 months back to ensure enough data for 125-day SMA on the 1Y chart

    const results = [];
    const benchmarkTickers = Array.from(new Set(tickersToFetch.map((ticker) => benchmarkForTicker(ticker, market, Boolean(customTickers)))));
    const benchmarkHistories = new Map<string, ChartQuote[]>();
    await Promise.all(benchmarkTickers.map(async (benchmarkTicker) => {
      try {
        const benchmarkChart = await yahooFinance.chart(benchmarkTicker, {
          period1,
          interval: '1d',
        }, { validateResult: false }) as ChartResponse;
        benchmarkHistories.set(benchmarkTicker, (benchmarkChart.quotes || []).filter((quote): quote is ChartQuote => quote.close != null));
      } catch (error) {
        console.error(`Failed to fetch benchmark ${benchmarkTicker}:`, error);
      }
    }));

    const quotesResponse = await yahooFinance.quote(tickersToFetch, {}, { validateResult: false }) as YahooQuote[] | YahooQuote;
    const quotes = Array.isArray(quotesResponse) ? quotesResponse : [quotesResponse];
    const quotesMap = new Map<string, YahooQuote>();
    quotes.forEach((q) => quotesMap.set(q.symbol, q));

    for (const ticker of tickersToFetch) {
      try {
        const chartData = await yahooFinance.chart(ticker, {
          period1,
          interval: '1d',
        }, { validateResult: false }) as ChartResponse;

        const quote = quotesMap.get(ticker);
        const currentPrice = quote?.regularMarketPrice;
        const companyName = quote?.longName || quote?.shortName || ticker;

        const history = (chartData.quotes || []).filter((q): q is ChartQuote => q.close != null);

        if (!history || history.length === 0 || !currentPrice) {
          continue;
        }

        const sma50 = calculateSMA(history, 50);
        const sma125 = calculateSMA(history, 125);
        const sma200 = calculateSMA(history, 200);
        const rsi = calculateRSI(history, 14);
        const bollingerBands = calculateBollingerBands(history, 20, 2);
        const macdData = calculateMACD(history);
        const volatility = calculateVolatility(history, 20);
        
        const latestVolume = history[history.length - 1].volume || 0;
        const previous20Sessions = history.slice(-21, -1);
        const avgVolume20 = previous20Sessions.reduce((acc, curr) => acc + (curr.volume || 0), 0) / (previous20Sessions.length || 1);

        const chartHistory = [];
        const chartHistoryLength = 252; // Return 1 year of trading data for timeframe selector
        const startIndex = Math.max(0, history.length - chartHistoryLength);
        
        for (let i = startIndex; i < history.length; i++) {
            const historyUpToI = history.slice(0, i + 1);
            const sma50AtDay = calculateSMA(historyUpToI, 50);
            const sma125AtDay = calculateSMA(historyUpToI, 125);
            const sma200AtDay = calculateSMA(historyUpToI, 200);
            chartHistory.push({
                date: new Date(history[i].date).toISOString(),
                close: history[i].close,
                volume: history[i].volume || null,
                sma50: sma50AtDay,
                sma125: sma125AtDay,
                sma200: sma200AtDay
            });
        }

        const itemData = {
          ticker,
          companyName,
          currentPrice,
          sma50,
          sma125,
          sma200,
          rsi,
          diffPercent50: sma50 ? ((currentPrice - sma50) / sma50) * 100 : null,
          diffPercent125: sma125 ? ((currentPrice - sma125) / sma125) * 100 : null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
          trailingPE: quote?.trailingPE ?? null,
          dividendYield: quote?.dividendYield ?? null,
          marketCap: quote?.marketCap ?? null,
          regularMarketChangePercent: quote?.regularMarketChangePercent ?? null,
          regularMarketOpen: quote?.regularMarketOpen ?? null,
          regularMarketDayHigh: quote?.regularMarketDayHigh ?? null,
          regularMarketDayLow: quote?.regularMarketDayLow ?? null,
          regularMarketPreviousClose: quote?.regularMarketPreviousClose ?? null,
          epsTrailingTwelveMonths: quote?.epsTrailingTwelveMonths ?? null,
          latestVolume,
          avgVolume20,
          chartHistory,
          bollingerBands,
          macdData,
          volatility,
          beta: calculateBeta(history, benchmarkHistories.get(benchmarkForTicker(ticker, market, Boolean(customTickers))) || [], 252),
          maxDrawdown: calculateMaxDrawdown(history, 252),
          earningsTimestamp: quote?.earningsTimestamp || null,
          priceToBook: quote?.priceToBook || null,
          bookValue: quote?.bookValue || null,
          fiftyDayAverage: quote?.fiftyDayAverage || null,
          twoHundredDayAverage: quote?.twoHundredDayAverage || null
        };
        
        const healthCheck = generateHealthCheck(itemData);
        const stock: StockData = {
          ...itemData,
          healthCheck,
          riskRewardScore: calculateRiskRewardScore({ ...itemData, healthCheck }),
          valuation: {
            trailingPE5yMedian: null,
            trailingPESectorMedian: null,
          },
        };

        results.push({ ...stock, signals: deriveStockSignals(stock) });
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
