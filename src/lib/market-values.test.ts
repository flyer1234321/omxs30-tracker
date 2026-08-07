import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDividendYield } from './market-values';

test('normalizes Nordic percentage-style dividend yields to decimals', () => {
  assert.equal(normalizeDividendYield(2.16), 0.0216);
  assert.equal(normalizeDividendYield(0.0216), 0.0216);
  assert.equal(normalizeDividendYield(null), null);
});
