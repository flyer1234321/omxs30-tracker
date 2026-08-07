import assert from 'node:assert/strict';
import test from 'node:test';
import { currencySuffix, formatPrice, formatSignedPercent } from './format';

test('uses the quoted currency instead of always assuming kronor', () => {
  assert.equal(formatPrice(123.456, 'SEK'), '123,46 kr');
  assert.equal(formatPrice(212.4, 'USD'), '212,40 $');
});

test('falls back to the raw currency code when the symbol is unknown', () => {
  assert.equal(currencySuffix('JPY'), 'JPY');
  assert.equal(currencySuffix(null), '');
});

test('formats missing values without crashing', () => {
  assert.equal(formatPrice(null, 'SEK'), '-');
  assert.equal(formatSignedPercent(null), '-');
});

test('always shows a sign on relative numbers', () => {
  assert.equal(formatSignedPercent(4.25), '+4,3 %');
  assert.equal(formatSignedPercent(-4.25), '-4,3 %');
});
