import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anyMarketOpen,
  cacheTtlForRegion,
  cacheTtlForRegions,
  isMarketOpen,
  regionForMarket,
  regionForTicker,
  regionsForTickers,
} from './market-hours';

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

test('a mixed favourite list follows whichever exchange is still trading', () => {
  // 18:00 svensk tid: Stockholm har stangt, New York handlar.
  const usAfternoon = new Date('2026-08-07T16:00:00Z');
  assert.equal(isMarketOpen('stockholm', usAfternoon), false);
  assert.equal(isMarketOpen('us', usAfternoon), true);

  const mixed = regionsForTickers(['VOLV-B.ST', 'AAPL']);
  assert.deepEqual(mixed, ['stockholm', 'us']);
  assert.equal(anyMarketOpen(mixed, usAfternoon), true);
  assert.equal(cacheTtlForRegions(mixed, usAfternoon), 5 * 60 * 1000);

  // Bara svenska bolag i listan: ingen anledning att halla datan fars.
  assert.equal(cacheTtlForRegions(['stockholm'], usAfternoon), 60 * 60 * 1000);
});
