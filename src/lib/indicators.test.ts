import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBeta, calculateMaxDrawdown, calculateRSI, calculateSMA, calculateVolatility } from './indicators';

test('calculateSMA returns null until enough points exist', () => {
  assert.equal(calculateSMA([{ close: 10 }, { close: 12 }], 3), null);
});

test('calculateSMA averages the latest period', () => {
  assert.equal(calculateSMA([{ close: 10 }, { close: 12 }, { close: 14 }], 2), 13);
});

test('calculateRSI returns 100 when the period has no losses', () => {
  const history = Array.from({ length: 15 }, (_, index) => ({ close: index + 1 }));
  assert.equal(calculateRSI(history, 14), 100);
});

test('calculateVolatility returns a non-negative percentage', () => {
  const history = Array.from({ length: 21 }, (_, index) => ({ close: 100 + index }));
  const volatility = calculateVolatility(history, 20);
  assert.equal(typeof volatility, 'number');
  assert.ok(volatility !== null && volatility >= 0);
});

test('calculateMaxDrawdown finds the largest fall from a previous peak', () => {
  const drawdown = calculateMaxDrawdown([{ close: 100 }, { close: 120 }, { close: 90 }, { close: 110 }]);
  assert.equal(drawdown, 25);
});

test('calculateBeta returns approximately one for identical return series', () => {
  const history = [100, 110, 105, 120, 125, 119, 130, 140, 136, 145, 150, 148, 160, 170, 165, 175, 180, 185, 190, 188, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240]
    .map((close, index) => ({ close, date: `2026-01-${String(index + 1).padStart(2, '0')}` }));
  const beta = calculateBeta(history, history);
  assert.ok(beta !== null && Math.abs(beta - 1) < 0.00001);
});
