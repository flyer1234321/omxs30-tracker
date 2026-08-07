import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveStockSignals } from './stock-signals';
import type { StockData } from '@/types/stock';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'TEST.ST', companyName: 'Test AB', currentPrice: 100,
    sma50: 101, sma125: 98, sma200: 99, rsi: 55, diffPercent125: 2,
    chartHistory: [
      { date: '2026-01-01T00:00:00.000Z', close: 98, sma50: 98, sma200: 99 },
      { date: '2026-01-02T00:00:00.000Z', close: 100, sma50: 101, sma200: 99 },
    ],
    fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 80, trailingPE: 12, dividendYield: null,
    marketCap: null, regularMarketChangePercent: 1, regularMarketOpen: null,
    regularMarketDayHigh: null, regularMarketDayLow: null, regularMarketPreviousClose: null,
    epsTrailingTwelveMonths: null, latestVolume: 2_000, avgVolume20: 900,
    volatility: 20, beta: 1, maxDrawdown: 15, riskRewardScore: 80, healthCheck: null,
    valuation: { trailingPE5yMedian: 16, trailingPESectorMedian: null },
    ...overrides,
  };
}

test('derives golden cross, volume spike and historical value discount signals', () => {
  const signals = deriveStockSignals(stock());
  assert.deepEqual(signals.map((signal) => signal.kind), ['goldenCross', 'volumeSpike', 'valueDiscount']);
});

test('does not label a stock as discounted without historical valuation data', () => {
  const signals = deriveStockSignals(stock({ valuation: { trailingPE5yMedian: null, trailingPESectorMedian: null } }));
  assert.equal(signals.some((signal) => signal.kind === 'valueDiscount'), false);
});
