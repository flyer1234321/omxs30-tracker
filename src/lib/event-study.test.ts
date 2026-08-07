import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bucketForSurprise,
  findAnnouncementIndex,
  isStatisticallyInteresting,
  measureEvent,
  summarise,
  type EventPricePoint,
} from './event-study';

function series(closes: number[], volumes?: number[]): EventPricePoint[] {
  return closes.map((close, index) => ({
    // Borjar 2026-01-01, en punkt per dag.
    date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    close,
    volume: volumes ? volumes[index] : 1000,
  }));
}

test('buckets surprises by size and direction', () => {
  assert.equal(bucketForSurprise(25), 'stor_positiv');
  assert.equal(bucketForSurprise(5), 'positiv');
  assert.equal(bucketForSurprise(0), 'neutral');
  assert.equal(bucketForSurprise(-1.5), 'neutral');
  assert.equal(bucketForSurprise(-6), 'negativ');
  assert.equal(bucketForSurprise(-40), 'stor_negativ');
});

test('finds the report day as the clearest volume spike after quarter end', () => {
  const volumes = new Array(60).fill(1000);
  volumes[30] = 9000; // rapportdagen
  const history = series(new Array(60).fill(0).map((_, index) => 100 + index * 0.1), volumes);

  // Kvartalet slutar pa forsta dagen i serien.
  const found = findAnnouncementIndex(history, history[0].date);
  assert.equal(found?.index, 30);
  assert.ok(found && found.volumeRatio > 5);
});

test('ignores volume spikes that fall outside the reporting window', () => {
  const volumes = new Array(60).fill(1000);
  volumes[2] = 9000; // for tidigt for att vara rapporten
  const history = series(new Array(60).fill(100), volumes);

  const found = findAnnouncementIndex(history, history[0].date, { minLagDays: 10, maxLagDays: 80 });
  assert.notEqual(found?.index, 2);
});

test('separates the reaction from the drift and adjusts for the index', () => {
  // Aktien: platt fram till handelsen, +5 % pa dagen, sedan +2 % pa fem dagar.
  const stock = series([100, 100, 105, 105.5, 106, 106.5, 106.8, 107.1]);
  // Index: helt platt, sa hela rorelsen ar bolagsspecifik.
  const benchmark = series([50, 50, 50, 50, 50, 50, 50, 50]);

  const outcome = measureEvent(stock, benchmark, 2, [5]);
  assert.equal(outcome.reactionPercent, 5);
  assert.equal(Number(outcome.driftPercent[5]?.toFixed(2)), 2);
  assert.equal(Number(outcome.abnormalDriftPercent[5]?.toFixed(2)), 2);
});

test('subtracts a rising market from the drift', () => {
  const stock = series([100, 100, 100, 101, 102, 103, 104, 105]);
  const benchmark = series([50, 50, 50, 50.5, 51, 51.5, 52, 52.5]);

  const outcome = measureEvent(stock, benchmark, 2, [5]);
  // Aktien +5 %, index +5 %: ingen overavkastning alls.
  assert.equal(Number(outcome.abnormalDriftPercent[5]?.toFixed(6)), 0);
});

test('returns nothing when the horizon runs past the available history', () => {
  const stock = series([100, 101, 102]);
  const outcome = measureEvent(stock, series([50, 50, 50]), 1, [60]);
  assert.equal(outcome.driftPercent[60], null);
});

test('summarises with a hit rate and a standard error', () => {
  const summary = summarise([2, 4, -1, 3, 2]);
  assert.equal(summary?.n, 5);
  assert.equal(summary?.mean, 2);
  assert.equal(summary?.median, 2);
  assert.equal(summary?.hitRate, 80);
  assert.ok(summary && summary.standardError > 0);
});

test('ignores missing observations instead of counting them as zero', () => {
  const summary = summarise([2, null, 4, null]);
  assert.equal(summary?.n, 2);
  assert.equal(summary?.mean, 3);
});

test('demands both a sample and a signal before calling a result interesting', () => {
  // Stort utslag men bara fyra observationer.
  assert.equal(isStatisticallyInteresting(summarise([10, 11, 9, 10])), false);
  // Manga observationer men ett medelvarde som drunknar i spridningen.
  const noisy = Array.from({ length: 40 }, (_, index) => (index % 2 === 0 ? 8 : -7.9));
  assert.equal(isStatisticallyInteresting(summarise(noisy)), false);
  assert.equal(isStatisticallyInteresting(null), false);
});
