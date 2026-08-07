import YahooFinance from 'yahoo-finance2';
import {
  calculateATR,
  calculateBollingerBands,
  calculateMACD,
  calculateBeta,
  calculateMaxDrawdown,
  calculateRelativeStrength,
  calculateRSI,
  calculateSMA,
  calculateSmaSeries,
  calculateVolatility,
  type PricePoint,
} from '@/lib/indicators';
import { deriveStockSignals } from '@/lib/stock-signals';
import { generateHealthCheck } from '@/lib/stock-health';
import { normalizeDividendYield } from '@/lib/market-values';
import { cacheTtlForRegions, regionForMarket, regionsForTickers } from '@/lib/market-hours';
import { parseTickerList } from '@/lib/ticker-validation';
import { buildTradePlan } from '@/lib/trade-plan';
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
  currency?: string;
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

/**
 * Hur många aktier som hämtas samtidigt. Yahoo Finance är ett inofficiellt
 * gratis-API som stryper trafik per IP. Sex parallella anrop är snabbt nog för
 * att hela listan ska hinna klart inom en serverless-timeout, men lågt nog att
 * inte se ut som en skrapare.
 */
const FETCH_CONCURRENCY = 6;

function benchmarkForTicker(ticker: string, market: string, isCustomRequest: boolean) {
  if (isCustomRequest) return ticker.endsWith('.ST') ? '^OMX' : '^GSPC';
  return BENCHMARKS[market] || BENCHMARKS.omxs30;
}

/** Kör uppgifterna med ett tak för hur många som pågår samtidigt. */
async function mapWithConcurrency<Input, Output>(
  items: Input[],
  limit: number,
  worker: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const results: Output[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    return runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

// Cache i minnet, per instans. Överlever inte en kall serverless-start, men
// fångar de upprepade anropen från en öppen flik.
let cache: Record<string, { data: unknown, lastUpdated: number }> = {};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
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

  // Stängd börs ger inga nya avslut, så cachen får leva betydligt längre då.
  // En egen bevakningslista kan innehålla bolag från båda börserna.
  const cacheTtl = cacheTtlForRegions(
    customTickers ? regionsForTickers(tickersToFetch) : [regionForMarket(market)],
  );
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.lastUpdated < cacheTtl) {
    return Response.json({ data: cached.data, cached: true, timestamp: cached.lastUpdated });
  }

  try {
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 18); // 18 månader bakåt ger underlag för SMA 125 på ettårsgrafen

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

    const settled = await mapWithConcurrency(tickersToFetch, FETCH_CONCURRENCY, async (ticker): Promise<StockData | null> => {
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
          return null;
        }

        const sma50 = calculateSMA(history, 50);
        const sma125 = calculateSMA(history, 125);
        const sma200 = calculateSMA(history, 200);
        const rsi = calculateRSI(history, 14);
        const bollingerBands = calculateBollingerBands(history, 20, 2);
        const macdData = calculateMACD(history);
        const volatility = calculateVolatility(history, 20);
        const atr = calculateATR(history, 14);

        const latestVolume = history[history.length - 1].volume || 0;
        const previous20Sessions = history.slice(-21, -1);
        const avgVolume20 = previous20Sessions.reduce((acc, curr) => acc + (curr.volume || 0), 0) / (previous20Sessions.length || 1);

        // Snitten beräknas en gång för hela serien och plockas sedan ut per dag.
        const sma50Series = calculateSmaSeries(history, 50);
        const sma125Series = calculateSmaSeries(history, 125);
        const sma200Series = calculateSmaSeries(history, 200);

        const chartHistoryLength = 252; // ett års handelsdata till periodväljaren
        const startIndex = Math.max(0, history.length - chartHistoryLength);
        const chartHistory = [];
        for (let i = startIndex; i < history.length; i++) {
          chartHistory.push({
            date: new Date(history[i].date).toISOString(),
            close: history[i].close,
            volume: history[i].volume || null,
            sma50: sma50Series[i],
            sma125: sma125Series[i],
            sma200: sma200Series[i],
          });
        }

        const benchmarkHistory = benchmarkHistories.get(benchmarkForTicker(ticker, market, Boolean(customTickers))) || [];

        // Medianvärdering det senaste året, med nuvarande vinst per aktie.
        const eps = quote?.epsTrailingTwelveMonths ?? null;
        const medianClose = median(history.slice(-252).map((point) => point.close));
        const trailingPEMedian = eps != null && eps > 0 && medianClose != null ? medianClose / eps : null;

        const itemData = {
          ticker,
          companyName,
          currency: quote?.currency ?? null,
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
          dividendYield: normalizeDividendYield(quote?.dividendYield),
          marketCap: quote?.marketCap ?? null,
          regularMarketChangePercent: quote?.regularMarketChangePercent ?? null,
          regularMarketOpen: quote?.regularMarketOpen ?? null,
          regularMarketDayHigh: quote?.regularMarketDayHigh ?? null,
          regularMarketDayLow: quote?.regularMarketDayLow ?? null,
          regularMarketPreviousClose: quote?.regularMarketPreviousClose ?? null,
          epsTrailingTwelveMonths: eps,
          latestVolume,
          avgVolume20,
          chartHistory,
          bollingerBands,
          macdData,
          volatility,
          atr,
          beta: calculateBeta(history, benchmarkHistory, 252),
          relativeStrength63: calculateRelativeStrength(history, benchmarkHistory, 63),
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
          tradePlan: buildTradePlan({
            currentPrice,
            atr,
            sma50,
            sma125,
            sma200,
            fiftyTwoWeekHigh: itemData.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: itemData.fiftyTwoWeekLow,
          }),
          valuation: {
            trailingPEMedian,
            trailingPESectorMedian: null,
          },
        };

        return { ...stock, signals: deriveStockSignals(stock) };
      } catch (err) {
        console.error(`Failed to fetch data for ${ticker}:`, err);
        return null;
      }
    });

    const results = settled.filter((stock): stock is StockData => stock !== null);

    cache[cacheKey] = {
      data: results,
      lastUpdated: Date.now()
    };

    return Response.json({ data: results, cached: false, timestamp: cache[cacheKey].lastUpdated });

  } catch (error) {
    console.error("API Error:", error);
    // Hellre gammal data än ett tomt fel: klienten slipper då försöka igen
    // direkt, vilket bara skulle belasta Yahoo ytterligare.
    if (cached) {
      return Response.json({ data: cached.data, cached: true, stale: true, timestamp: cached.lastUpdated });
    }
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
