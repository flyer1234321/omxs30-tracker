import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheTtlForRegion, isMarketOpen, regionForMarket, regionForTicker } from './market-hours';

// 2026-08-07 var en fredag.
const fridayMidday = new Date('2026-08-07T11:00:00Z');   // 13:00 i Stockholm
const fridayEvening = new Date('2026-08-07T19:00:00Z');  // 21:00 i Stockholm
const saturday = new Date('2026-08-08T11:00:00Z');

test('knows when Stockholm is trading', () => {
  assert.equal(isMarketOpen('stockholm', fridayMidday), true);
  assert.equal(isMarketOpen('stockholm', fridayEvening), false);
  assert.equal(isMarketOpen('stockholm', saturday), false);
});

test('maps markets and tickers to the right exchange', () => {
  assert.equal(regionForMarket('omxs30'), 'stockholm');
  assert.equal(regionForMarket('tech'), 'us');
  assert.equal(regionForTicker('VOLV-B.ST'), 'stockholm');
  assert.equal(regionForTicker('AAPL'), 'us');
});

test('holds the cache far longer when the exchange is closed', () => {
  assert.equal(cacheTtlForRegion('stockholm', fridayMidday), 5 * 60 * 1000);
  assert.equal(cacheTtlForRegion('stockholm', saturday), 60 * 60 * 1000);
});
