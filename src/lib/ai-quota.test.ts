import assert from 'node:assert/strict';
import test from 'node:test';
import { aiQuotaFromUsage } from './ai-quota';

test('finite AI quota reports used and remaining requests', () => {
  assert.deepEqual(aiQuotaFromUsage(5, 2), {
    allowed: true,
    remaining: 3,
    used: 2,
    dailyLimit: 5,
    available: true,
  });
});

test('finite AI quota is exhausted at the configured limit', () => {
  assert.deepEqual(aiQuotaFromUsage(3, 4), {
    allowed: false,
    remaining: 0,
    used: 4,
    dailyLimit: 3,
    available: true,
  });
});

test('zero means unlimited AI requests', () => {
  assert.deepEqual(aiQuotaFromUsage(0, 8), {
    allowed: true,
    remaining: null,
    used: 8,
    dailyLimit: 0,
    available: true,
  });
});
