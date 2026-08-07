import assert from 'node:assert/strict';
import test from 'node:test';
import { applyProFilter, getActiveFilterCount } from './pro-filter';

const stocks = [
  {
    ticker: 'AAA',
    currentPrice: 90,
    rsi: 25,
    trailingPE: 10,
    dividendYield: 0.05,
    sma125: 100,
    latestVolume: 200,
    avgVolume20: 100,
  },
  {
    ticker: 'BBB',
    currentPrice: 120,
    rsi: 55,
    trailingPE: 30,
    dividendYield: 0.01,
    sma125: 100,
    latestVolume: 90,
    avgVolume20: 100,
  },
];

test('applyProFilter combines criteria with AND logic', () => {
  const result = applyProFilter(stocks, { rsiMax: 30, peMax: 15, belowSMA125: true });
  assert.deepEqual(result.map((stock) => stock.ticker), ['AAA']);
});

test('applyProFilter excludes missing required values', () => {
  const result = applyProFilter([{ ticker: 'CCC', currentPrice: 10, rsi: null }], { rsiMax: 30 });
  assert.deepEqual(result, []);
});

test('getActiveFilterCount counts numeric and boolean filters', () => {
  assert.equal(getActiveFilterCount({ rsiMax: 30, peMax: 20, belowSMA125: true }), 3);
});
