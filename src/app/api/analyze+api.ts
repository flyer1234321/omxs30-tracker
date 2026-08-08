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
import { mapWithConcurrency } from '@/lib/concurrency';
import { loadQualityInputs, qualityForTicker } from '@/lib/quality-data';
import { benchmarkForTicker, MARKETS } from '@/lib/markets';
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

/**
 * Hur många aktier som hämtas samtidigt. Yahoo Finance är ett inofficiellt
 * gratis-API som stryper trafik per IP. Sex parallella anrop är snabbt nog för
 * att hela listan ska hinna klart inom en serverless-timeout, men lågt nog att
 * inte se ut som en skrapare.
 */
const FETCH_CONCURRENCY = 6;

// Cache i minnet, per instans. Överlever inte en kall serverless-start, men
// fångar de upprepade anropen från en öppen flik.
let cache: Record<string, { data: unknown, lastUpdated: number }> = {};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
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

    // Balansräkningen har egen dygnscache, så den här raden kostar bara anrop
    // en gång per dag och bolag - inte vid varje uppdatering av kurserna.
    const qualityInputs = await loadQualityInputs(tickersToFetch);

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

        // Prisbaserad värderingsproxy för senaste året. Dagens VPA hålls
        // konstant, så detta är inte en historisk serie av rapporterade P/E-tal.
        const eps = quote?.epsTrailingTwelveMonths ?? null;
        const medianClose = median(history.slice(-252).map((point) => point.close));
        const trailingPEProxyMedian = eps != null && eps > 0 && medianClose != null ? medianClose / eps : null;

        const itemData = {
          ticker,
          companyName,
          sector: qualityInputs.get(ticker)?.sector ?? null,
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
          tradePlan: buildTradePlan({
            currentPrice,
            atr,
            sma50,
            sma125,
            sma200,
            fiftyTwoWeekHigh: itemData.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: itemData.fiftyTwoWeekLow,
          }),
          quality: qualityForTicker(qualityInputs.get(ticker), quote?.marketCap ?? null),
          valuation: {
            trailingPEProxyMedian,
            trailingPESectorMedian: null,
            sectorSampleSize: 0,
          },
        };

        return stock;
      } catch (err) {
        console.error(`Failed to fetch data for ${ticker}:`, err);
        return null;
      }
    });

    const results = settled.filter((stock): stock is StockData => stock !== null);
    const peBySector = new Map<string, number[]>();
    results.forEach((stock) => {
      if (!stock.sector || stock.trailingPE == null || stock.trailingPE <= 0) return;
      const values = peBySector.get(stock.sector) ?? [];
      values.push(stock.trailingPE);
      peBySector.set(stock.sector, values);
    });

    // Sektormedianen beräknas först när hela marknadsurvalet är hämtat. Minst
    // tre bolag krävs för att ett enskilt bolag inte ska dominera jämförelsen.
    const enrichedResults = results.map((stock): StockData => {
      const sectorValues = stock.sector ? peBySector.get(stock.sector) ?? [] : [];
      const valuation = {
        trailingPEProxyMedian: stock.valuation?.trailingPEProxyMedian ?? null,
        trailingPESectorMedian: sectorValues.length >= 3 ? median(sectorValues) : null,
        sectorSampleSize: sectorValues.length,
      };
      const enriched = { ...stock, valuation };
      return { ...enriched, signals: deriveStockSignals(enriched) };
    });

    cache[cacheKey] = {
      data: enrichedResults,
      lastUpdated: Date.now()
    };

    return Response.json({ data: enrichedResults, cached: false, timestamp: cache[cacheKey].lastUpdated });

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
