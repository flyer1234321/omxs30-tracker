import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeThemeMode } from './theme-mode';

test('normalizes persisted theme values', () => {
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('unexpected'), 'dark');
  assert.equal(normalizeThemeMode(null), 'dark');
});
