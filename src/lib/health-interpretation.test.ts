import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretHealth } from './health-interpretation';
import type { HealthCheck, StockData } from '@/types/stock';

function health(overrides: Partial<HealthCheck> = {}): HealthCheck {
  return {
    grade: 'B',
    gradeScore: 5,
    summary: '',
    riskLevel: 'Medel',
    momentum: 'Sidledes',
    checklist: [
      { label: 'a', passed: true, detail: '' },
      { label: 'b', passed: true, detail: '' },
      { label: 'c', passed: true, detail: '' },
      { label: 'd', passed: false, detail: '' },
      { label: 'e', passed: false, detail: '' },
      { label: 'f', passed: false, detail: '' },
    ],
    bonuses: [
      { label: 'x', passed: true, detail: '' },
      { label: 'y', passed: true, detail: '' },
      { label: 'z', passed: false, detail: '' },
    ],
    ...overrides,
  };
}

function stock(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: 'TEST.ST', companyName: 'Test AB', sector: 'Industrials', currency: 'SEK', currentPrice: 100,
    sma50: 105, sma125: 110, sma200: 115, rsi: 35, diffPercent125: -9, chartHistory: [],
    fiftyTwoWeekHigh: 140, fiftyTwoWeekLow: 95, trailingPE: 12, dividendYield: 0.03,
    marketCap: null, regularMarketChangePercent: -1, regularMarketOpen: null,
    regularMarketDayHigh: null, regularMarketDayLow: null, regularMarketPreviousClose: null,
    epsTrailingTwelveMonths: 8, latestVolume: 1000, avgVolume20: 900, volatility: 25,
    beta: 1, maxDrawdown: 20, healthCheck: health(),
    atr: 2, relativeStrength63: -3, earningsTimestamp: null, priceToBook: 1.2, bookValue: 80,
    tradePlan: null, quality: null,
    ...overrides,
  };
}

test('breaks the score down into its two parts', () => {
  const result = interpretHealth(stock());
  assert.match(result!.scoreExplanation, /5 av 9 poäng/);
  assert.match(result!.scoreExplanation, /3 av 6 grundkriterier/);
  assert.match(result!.scoreExplanation, /2 av 3 tekniska bonusar/);
});

test('warns that a high score mostly means the price has fallen', () => {
  const result = interpretHealth(stock({ healthCheck: health({ gradeScore: 7 }) }));
  assert.match(result!.scoreExplanation, /gått ned mycket, inte att bolaget är bra/);
});

test('tells an owner when the stock is below both trend lines', () => {
  const result = interpretHealth(stock());
  assert.match(result!.ifYouOwn, /under både halvårs- och årssnittet/);
});

test('an upcoming report outranks the technical levels', () => {
  const now = Date.UTC(2026, 0, 10);
  const result = interpretHealth(stock({ earningsTimestamp: Date.UTC(2026, 0, 13) }), now);
  assert.match(result!.ifYouOwn, /Rapport om 3 dagar/);
  assert.match(result!.ifYouConsiderBuying, /satsa på innehållet/);
});

test('points out when the reward is smaller than the risk', () => {
  const result = interpretHealth(stock({
    tradePlan: {
      atr: 2, atrPercent: 2, stopLoss: 96, stopBasis: '', target: 102, targetBasis: '',
      riskPerShare: 4, riskPercent: 4, rewardPercent: 2, rMultiple: 0.5,
    },
  }));
  assert.match(result!.ifYouConsiderBuying, /ha rätt oftare än du har fel/);
});

test('asks the owner the only question that matters', () => {
  const result = interpretHealth(stock({
    tradePlan: {
      atr: 2, atrPercent: 2, stopLoss: 96, stopBasis: '', target: 112, targetBasis: '',
      riskPerShare: 4, riskPercent: 4, rewardPercent: 12, rMultiple: 3,
    },
  }));
  assert.match(result!.ifYouOwn, /skulle köpa aktien i dag/);
});

test('returns nothing without a health check', () => {
  assert.equal(interpretHealth(stock({ healthCheck: null })), null);
});

test('flags the combination that makes dip models dangerous', () => {
  const result = interpretHealth(stock({
    healthCheck: health({ grade: 'A', gradeScore: 8 }),
    quality: {
      score: 2, measured: 5, label: 'Svag', debtNotComparable: false,
      components: [],
    },
  }));
  assert.match(result!.qualityVerdict!, /gör rekylmodeller farliga/);
});

test('separates a large fall in a well run company from a value trap', () => {
  const result = interpretHealth(stock({
    healthCheck: health({ grade: 'A', gradeScore: 8 }),
    quality: {
      score: 9, measured: 5, label: 'Stark', debtNotComparable: false,
      components: [],
    },
  }));
  assert.match(result!.qualityVerdict!, /mer intressanta varianten/);
});

test('says nothing about quality when the data is missing', () => {
  assert.equal(interpretHealth(stock())!.qualityVerdict, null);
});
