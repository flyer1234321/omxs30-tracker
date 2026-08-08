import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuantAnalystReport } from './analyst-engine';
import type { StockData } from '@/types/stock';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'TEST.ST', companyName: 'Test AB', currentPrice: 110,
    sma50: 105, sma125: 100, sma200: 98, rsi: 55, diffPercent125: 10,
    chartHistory: [], fiftyTwoWeekHigh: 112, fiftyTwoWeekLow: 80, trailingPE: 15,
    dividendYield: 0.04, marketCap: null, regularMarketChangePercent: 1,
    regularMarketOpen: null, regularMarketDayHigh: null, regularMarketDayLow: null,
    regularMarketPreviousClose: null, epsTrailingTwelveMonths: null,
    latestVolume: null, avgVolume20: null, volatility: 20, beta: 1,
    maxDrawdown: 15, riskRewardScore: 80, healthCheck: null,
    currency: 'SEK', atr: 2.2, tradePlan: null, relativeStrength63: null,
    earningsTimestamp: null, priceToBook: null, bookValue: null,
    quality: null,
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
    volatility: 55, maxDrawdown: 40, riskRewardScore: 25,
  }));
  assert.equal(report.verdict, 'Avvakta');
  assert.ok(report.risks.length > 0);
});
