import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuantAnalystReport, calculateDataCoverage } from './analyst-engine';
import type { StockData } from '@/types/stock';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'TEST.ST', companyName: 'Test AB', sector: 'Industrials', currentPrice: 110,
    sma50: 105, sma125: 100, sma200: 98, rsi: 55, diffPercent125: 10,
    chartHistory: [], fiftyTwoWeekHigh: 112, fiftyTwoWeekLow: 80, trailingPE: 15,
    dividendYield: 0.04, marketCap: null, regularMarketChangePercent: 1,
    regularMarketOpen: null, regularMarketDayHigh: null, regularMarketDayLow: null,
    regularMarketPreviousClose: null, epsTrailingTwelveMonths: null,
    latestVolume: null, avgVolume20: null, volatility: 20, beta: 1,
    maxDrawdown: 15, healthCheck: null,
    currency: 'SEK', atr: 2.2, tradePlan: null, relativeStrength63: null,
    earningsTimestamp: null, priceToBook: null, bookValue: null,
    quality: null,
    valuation: { trailingPEProxyMedian: 20, trailingPESectorMedian: 18, sectorSampleSize: 6 },
    ...overrides,
  };
}

test('gives a positive analysis when trend, valuation and risk signals align', () => {
  const report = buildQuantAnalystReport(stock());
  assert.equal(report.verdict, 'Positiv analys');
  assert.equal(report.source, 'quant');
  assert.ok(report.score >= 68);
});

test('waits when trend, valuation and risk metrics deteriorate', () => {
  const report = buildQuantAnalystReport(stock({
    currentPrice: 80, sma125: 100, sma200: 110, rsi: 75, trailingPE: 45,
    volatility: 55, maxDrawdown: 40,
  }));
  assert.equal(report.verdict, 'Avvakta');
  assert.ok(report.risks.length > 0);
});

test('reports how much of the model input is actually available', () => {
  const coverage = calculateDataCoverage(stock());
  assert.deepEqual(coverage, {
    available: 10,
    total: 18,
    percentage: 56,
    label: 'God',
  });
});

test('labels sparse input as limited rather than expressing false certainty', () => {
  const coverage = calculateDataCoverage(stock({
    sma125: null,
    sma200: null,
    rsi: null,
    trailingPE: null,
    valuation: undefined,
    volatility: null,
    maxDrawdown: null,
    beta: null,
    atr: null,
  }));
  assert.equal(coverage.available, 0);
  assert.equal(coverage.label, 'Begränsad');
});
