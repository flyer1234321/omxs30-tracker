import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPosition,
  isValidHolding,
  looksLikeSplit,
  portfolioWeight,
  summarisePortfolio,
  type Holding,
} from './holdings';
import type { StockData } from '@/types/stock';

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'SSAB-B.ST', companyName: 'SSAB B', currency: 'SEK', currentPrice: 60,
    sma50: null, sma125: null, sma200: null, rsi: null, diffPercent125: null, chartHistory: [],
    fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, trailingPE: null, dividendYield: null,
    marketCap: null, regularMarketChangePercent: 2, regularMarketOpen: null,
    regularMarketDayHigh: null, regularMarketDayLow: null, regularMarketPreviousClose: 58,
    epsTrailingTwelveMonths: null, latestVolume: null, avgVolume20: null, volatility: null,
    beta: null, maxDrawdown: null, healthCheck: null, atr: null, tradePlan: null,
    relativeStrength63: null, earningsTimestamp: null, priceToBook: null, bookValue: null,
    quality: null, sector: null,
    ...overrides,
  };
}

const holding: Holding = { ticker: 'SSAB-B.ST', shares: 300, averagePrice: 50 };

test('rejects incomplete or nonsensical holdings', () => {
  assert.equal(isValidHolding(holding), true);
  assert.equal(isValidHolding({ ticker: 'A', shares: 0, averagePrice: 10 }), false);
  assert.equal(isValidHolding({ ticker: 'A', shares: 10, averagePrice: -1 }), false);
  assert.equal(isValidHolding({ ticker: '', shares: 10, averagePrice: 10 }), false);
  assert.equal(isValidHolding(null), false);
});

test('turns shares and cost into value and profit', () => {
  const position = buildPosition(stock(), holding)!;
  assert.equal(position.marketValue, 18_000);
  assert.equal(position.costBasis, 15_000);
  assert.equal(position.unrealisedAmount, 3_000);
  assert.equal(position.unrealisedPercent, 20);
});

test('uses yesterdays close for the day move, not the percentage', () => {
  // 60 mot 58 gar 2 kronor upp, gange 300 aktier.
  const position = buildPosition(stock(), holding)!;
  assert.equal(position.dayChangeAmount, 600);
});

test('falls back to the percentage when the previous close is missing', () => {
  const position = buildPosition(stock({ regularMarketPreviousClose: null }), holding)!;
  assert.ok(Math.abs(position.dayChangeAmount! - (18_000 - 18_000 / 1.02)) < 0.001);
});

test('translates the stop level into money at risk', () => {
  const withPlan = stock({
    tradePlan: {
      atr: 2, atrPercent: 3.3, stopLoss: 55, stopBasis: '', target: 70, targetBasis: '',
      riskPerShare: 5, riskPercent: 8.3, rewardPercent: 16.7, rMultiple: 2,
    },
  });
  const position = buildPosition(withPlan, holding)!;
  // 5 kronor per aktie gange 300 aktier.
  assert.equal(position.riskToStopAmount, 1_500);
});

test('sums the portfolio and computes weights', () => {
  const a = buildPosition(stock(), holding)!;
  const b = buildPosition(
    stock({ ticker: 'VOLV-B.ST', currentPrice: 300, regularMarketPreviousClose: 300 }),
    { ticker: 'VOLV-B.ST', shares: 20, averagePrice: 250 },
  )!;

  const summary = summarisePortfolio([a, b]);
  assert.equal(summary.marketValue, 24_000);
  assert.equal(summary.costBasis, 20_000);
  assert.equal(summary.unrealisedAmount, 4_000);
  assert.equal(summary.unrealisedPercent, 20);
  assert.equal(summary.mixedCurrencies, false);
  assert.equal(Math.round(portfolioWeight(a, summary)), 75);
});

test('flags mixed currencies instead of quietly adding them up', () => {
  const swedish = buildPosition(stock(), holding)!;
  const american = buildPosition(
    stock({ ticker: 'AAPL', currency: 'USD', currentPrice: 200, regularMarketPreviousClose: 200 }),
    { ticker: 'AAPL', shares: 10, averagePrice: 150 },
  )!;

  const summary = summarisePortfolio([swedish, american]);
  assert.equal(summary.mixedCurrencies, true);
  assert.equal(summary.currency, null);
});

test('spots a probable share split', () => {
  // Kursen halverad mot registrerat GAV: ser ut som en split pa 2 for 1.
  const halved = buildPosition(stock({ currentPrice: 25 }), holding)!;
  assert.equal(looksLikeSplit(halved), true);

  const normal = buildPosition(stock(), holding)!;
  assert.equal(looksLikeSplit(normal), false);
});

test('returns nothing when there is no holding', () => {
  assert.equal(buildPosition(stock(), undefined), null);
});
