import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFavoriteTickers } from './favorite-tickers';

test('normalizes, deduplicates and limits cloud favorite tickers', () => {
  assert.deepEqual(normalizeFavoriteTickers([' arpl.st ', 'VOLV-B.ST', 'ARPL.ST', '']), ['ARPL.ST', 'VOLV-B.ST']);
  assert.equal(normalizeFavoriteTickers(Array.from({ length: 70 }, (_, index) => `TEST${index}.ST`)).length, 60);
});
