import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginRateLimiter } from './login-rate-limit';

test('locks a client for 30 minutes after five failed attempts within 15 minutes', () => {
  const limiter = new LoginRateLimiter();
  const start = 1_000_000;
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal(limiter.recordFailure('192.0.2.1', start + attempt * 1_000).allowed, true);
  }

  const blocked = limiter.recordFailure('192.0.2.1', start + 5_000);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.retryAfterSeconds, 30 * 60);
  assert.equal(limiter.check('192.0.2.1', start + 30 * 60 * 1_000 + 6_000).allowed, true);
});

test('starts a new attempt window after 15 minutes', () => {
  const limiter = new LoginRateLimiter();
  const start = 1_000_000;
  for (let attempt = 0; attempt < 4; attempt++) limiter.recordFailure('192.0.2.1', start + attempt * 1_000);
  assert.equal(limiter.recordFailure('192.0.2.1', start + 16 * 60 * 1_000).allowed, true);
});
