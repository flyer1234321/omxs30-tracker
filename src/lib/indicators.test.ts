import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRSI, calculateSMA, calculateVolatility } from './indicators';

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
