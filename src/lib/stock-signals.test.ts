import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveStockSignals } from './stock-signals';
import type { StockData } from '@/types/stock';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'TEST.ST', companyName: 'Test AB', sector: 'Industrials', currentPrice: 100,
    sma50: 101, sma125: 98, sma200: 99, rsi: 55, diffPercent125: 2,
    chartHistory: [
      { date: '2026-01-01T00:00:00.000Z', close: 98, sma50: 98, sma200: 99 },
      { date: '2026-01-02T00:00:00.000Z', close: 100, sma50: 101, sma200: 99 },
    ],
    fiftyTwoWeekHigh: 120, fiftyTwoWeekLow: 80, trailingPE: 12, dividendYield: null,
    marketCap: null, regularMarketChangePercent: 1, regularMarketOpen: null,
    regularMarketDayHigh: null, regularMarketDayLow: null, regularMarketPreviousClose: null,
    epsTrailingTwelveMonths: null, latestVolume: 2_000, avgVolume20: 900,
    volatility: 20, beta: 1, maxDrawdown: 15, healthCheck: null,
    currency: 'SEK', atr: 2, tradePlan: null, relativeStrength63: null,
    earningsTimestamp: null, priceToBook: null, bookValue: null,
    quality: null,
    valuation: { trailingPEProxyMedian: 16, trailingPESectorMedian: null, sectorSampleSize: 0 },
    ...overrides,
  };
}

test('derives golden cross, volume spike and historical value discount signals', () => {
  const signals = deriveStockSignals(stock());
  assert.deepEqual(signals.map((signal) => signal.kind), ['goldenCross', 'volumeSpike', 'valueDiscount']);
});

test('does not label a stock as discounted without historical valuation data', () => {
  const signals = deriveStockSignals(stock({ valuation: { trailingPEProxyMedian: null, trailingPESectorMedian: null, sectorSampleSize: 0 } }));
  assert.equal(signals.some((signal) => signal.kind === 'valueDiscount'), false);
});

test('still reports a golden cross that happened a few days ago', () => {
  const chartHistory = [
    { date: '2026-01-01T00:00:00.000Z', close: 98, sma50: 98, sma200: 99 },
    { date: '2026-01-02T00:00:00.000Z', close: 100, sma50: 101, sma200: 99 },
    { date: '2026-01-05T00:00:00.000Z', close: 101, sma50: 102, sma200: 99 },
    { date: '2026-01-06T00:00:00.000Z', close: 102, sma50: 103, sma200: 99 },
  ];
  const signals = deriveStockSignals(stock({ chartHistory }));
  const goldenCross = signals.find((signal) => signal.kind === 'goldenCross');
  assert.equal(goldenCross?.label, 'GC 2d');
});

test('flags an upcoming earnings report as a reason for caution', () => {
  const now = Date.UTC(2026, 0, 10);
  const signals = deriveStockSignals(
    stock({ earningsTimestamp: Date.UTC(2026, 0, 13) }),
    now,
  );
  const earnings = signals.find((signal) => signal.kind === 'earningsSoon');
  assert.equal(earnings?.label, 'RAPPORT 3d');
});

test('ignores earnings dates that are far away', () => {
  const now = Date.UTC(2026, 0, 10);
  const signals = deriveStockSignals(stock({ earningsTimestamp: Date.UTC(2026, 2, 13) }), now);
  assert.equal(signals.some((signal) => signal.kind === 'earningsSoon'), false);
});
