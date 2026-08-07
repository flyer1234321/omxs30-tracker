import assert from 'node:assert/strict';
import test from 'node:test';
import { CooldownLimiter, LoginRateLimiter } from './login-rate-limit';

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

test('the cooldown limiter blocks a second link within the minute', () => {
  const limiter = new CooldownLimiter(60_000, 5, 60 * 60_000);
  const start = 1_000_000;

  assert.equal(limiter.check('a@b.se', start).allowed, true);
  limiter.record('a@b.se', start);

  const immediate = limiter.check('a@b.se', start + 10_000);
  assert.equal(immediate.allowed, false);
  assert.equal(immediate.retryAfterSeconds, 50);

  assert.equal(limiter.check('a@b.se', start + 61_000).allowed, true);
});

test('the cooldown limiter caps the number of links per hour', () => {
  const limiter = new CooldownLimiter(0, 3, 60 * 60_000);
  const start = 1_000_000;
  for (let index = 0; index < 3; index += 1) limiter.record('a@b.se', start + index * 1000);

  assert.equal(limiter.check('a@b.se', start + 4000).allowed, false);
  // En timme efter det forsta utskicket faller det ur fonstret.
  assert.equal(limiter.check('a@b.se', start + 60 * 60_000 + 1).allowed, true);
});

test('limits are tracked per key', () => {
  const limiter = new CooldownLimiter(60_000, 5, 60 * 60_000);
  limiter.record('a@b.se', 1_000_000);
  assert.equal(limiter.check('c@d.se', 1_000_000).allowed, true);
});
