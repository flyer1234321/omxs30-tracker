import YahooFinance from 'yahoo-finance2';
import { mapWithConcurrency } from '@/lib/concurrency';
import { calculateQualityScore, type QualityInput, type QualityScore } from '@/lib/quality-score';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false },
});

/**
 * Balansräkningen ändras fyra gånger om året. Att hämta den i takt med kursen
 * hade dubblat antalet anrop mot Yahoo helt i onödan, så den har en egen cache
 * med ett dygns livslängd oberoende av priscachen.
 *
 * Cachen ligger i minnet och överlever inte en kall serverless-start. Det gör
 * inte så mycket: hämtningen är bäst-möjliga och en aktie utan kvalitetsdata
 * visas ändå, bara utan det måttet.
 */
const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { input: QualityInput; cachedAt: number }>();

interface FinancialDataResponse {
  financialData?: {
    totalCash?: number;
    totalDebt?: number;
    ebitda?: number;
    currentRatio?: number;
    debtToEquity?: number;
    returnOnEquity?: number;
    freeCashflow?: number;
    operatingMargins?: number;
    profitMargins?: number;
    revenueGrowth?: number;
  };
  summaryProfile?: {
    sector?: string;
    industry?: string;
  };
}

async function loadOne(ticker: string): Promise<QualityInput | null> {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) return cached.input;

  try {
    // Båda modulerna hämtas i samma anrop, så sektorn kostar ingenting extra.
    const summary = await yahooFinance.quoteSummary(
      ticker,
      { modules: ['financialData', 'summaryProfile'] },
      { validateResult: false },
    ) as FinancialDataResponse;

    const financial = summary.financialData;
    if (!financial) return null;

    const input: QualityInput = {
      sector: summary.summaryProfile?.sector ?? null,
      debtToEquity: financial.debtToEquity ?? null,
      totalDebt: financial.totalDebt ?? null,
      totalCash: financial.totalCash ?? null,
      ebitda: financial.ebitda ?? null,
      currentRatio: financial.currentRatio ?? null,
      freeCashflow: financial.freeCashflow ?? null,
      returnOnEquity: financial.returnOnEquity ?? null,
      operatingMargins: financial.operatingMargins ?? null,
      profitMargins: financial.profitMargins ?? null,
      revenueGrowth: financial.revenueGrowth ?? null,
    };

    cache.set(ticker, { input, cachedAt: Date.now() });
    return input;
  } catch (error) {
    console.error(`Quality data failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Hämtar kvalitetsunderlaget för flera bolag. Misslyckade anrop hoppas över:
 * ett saknat kvalitetsmått är bättre än ett svar utan aktier i.
 */
export async function loadQualityInputs(tickers: string[]) {
  const results = await mapWithConcurrency(tickers, 4, async (ticker) => ({ ticker, input: await loadOne(ticker) }));
  const map = new Map<string, QualityInput>();
  results.forEach(({ ticker, input }) => { if (input) map.set(ticker, input); });
  return map;
}

export function qualityForTicker(input: QualityInput | undefined, marketCap: number | null): QualityScore | null {
  if (!input) return null;
  const score = calculateQualityScore({ ...input, marketCap });
  return score.label === 'Otillräckligt underlag' ? null : score;
}
