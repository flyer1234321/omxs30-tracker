import assert from 'node:assert/strict';
import test from 'node:test';
import { appLocale, normalizeLanguage } from './language';

test('uses Swedish by default', () => {
  assert.equal(normalizeLanguage(undefined), 'sv');
  assert.equal(normalizeLanguage('de'), 'sv');
});

test('accepts English explicitly', () => {
  assert.equal(normalizeLanguage('en'), 'en');
});

test('returns the matching locale', () => {
  assert.equal(appLocale('sv'), 'sv-SE');
  assert.equal(appLocale('en'), 'en-GB');
});
