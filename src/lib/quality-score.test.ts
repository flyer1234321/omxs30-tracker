import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateQualityScore, type QualityInput } from './quality-score';

const solid: QualityInput = {
  sector: 'Industrials',
  totalDebt: 1_000, totalCash: 800, ebitda: 1_000,
  returnOnEquity: 0.22, operatingMargins: 0.19,
  freeCashflow: 600, marketCap: 10_000, revenueGrowth: 0.12,
};

const strained: QualityInput = {
  sector: 'Industrials',
  totalDebt: 9_000, totalCash: 200, ebitda: 1_000,
  returnOnEquity: 0.02, operatingMargins: 0.03,
  freeCashflow: -400, marketCap: 5_000, revenueGrowth: -0.09,
};

test('a well run company scores high', () => {
  const result = calculateQualityScore(solid);
  assert.equal(result.score, 10);
  assert.equal(result.label, 'Stark');
  assert.equal(result.measured, 5);
});

test('a company that burns cash while carrying debt scores at the bottom', () => {
  const result = calculateQualityScore(strained);
  assert.equal(result.score, 0);
  assert.equal(result.label, 'Svag');
  assert.match(result.components.find((c) => c.id === 'cashflow')!.detail, /förbrukar kassa/);
  assert.match(result.components.find((c) => c.id === 'debt')!.detail, /ansträngt/);
});

test('leverage is not held against banks and property companies', () => {
  const bank = calculateQualityScore({ ...solid, sector: 'Financial Services', debtToEquity: 900 });
  assert.equal(bank.debtNotComparable, true);
  assert.equal(bank.components.find((c) => c.id === 'debt')!.points, null);
  // Skulden raknas bort helt, sa de fyra ovriga far bara betyget.
  assert.equal(bank.measured, 4);
  assert.equal(bank.score, 10);

  const property = calculateQualityScore({ ...solid, sector: 'Real Estate' });
  assert.equal(property.debtNotComparable, true);
});

test('missing values are excluded rather than counted as zero', () => {
  const partial = calculateQualityScore({
    sector: 'Industrials', returnOnEquity: 0.2, operatingMargins: 0.2, freeCashflow: 500, marketCap: 5_000,
  });
  assert.equal(partial.measured, 3);
  assert.equal(partial.score, 10);
  assert.equal(partial.components.find((c) => c.id === 'growth')!.points, null);
});

test('too little data gives no score at all', () => {
  const result = calculateQualityScore({ sector: 'Industrials', returnOnEquity: 0.2 });
  assert.equal(result.label, 'Otillräckligt underlag');
  assert.equal(result.score, 0);
});

test('falls back to debt over equity when EBITDA is missing', () => {
  const result = calculateQualityScore({ ...solid, totalDebt: null, ebitda: null, debtToEquity: 40 });
  assert.match(result.components.find((c) => c.id === 'debt')!.detail, /Skuld \/ eget kapital: 40 %/);
  assert.equal(result.components.find((c) => c.id === 'debt')!.points, 2);
});

test('a loss making company is marked as such', () => {
  const result = calculateQualityScore({ ...solid, returnOnEquity: -0.15 });
  assert.match(result.components.find((c) => c.id === 'profitability')!.detail, /förlust/);
});
