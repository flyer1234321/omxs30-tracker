import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateObservations,
  collectObservations,
  computeTechnicalScoreSeries,
  edgeOverBaseline,
  MAX_TECHNICAL_SCORE,
} from './rekyl-backtest';
import { calculateRsiSeries, calculateSmaSeries, calculateLowerBandSeries, rollingExtremes } from './indicators';
import type { EventPricePoint } from './event-study';

function series(closes: number[]): EventPricePoint[] {
  return closes.map((close, index) => ({
    date: new Date(Date.UTC(2020, 0, 1 + index)).toISOString(),
    close,
    volume: 1000,
  }));
}

test('the rolling RSI matches the one shot calculation at every point', () => {
  const history = series(Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 7) * 10 + i * 0.05));
  const rolling = calculateRsiSeries(history, 14);

  for (const index of [20, 50, 120, 199]) {
    const oneShot = calculateRsiSeries(history.slice(0, index + 1), 14).at(-1);
    assert.ok(Math.abs(rolling[index]! - oneShot!) < 1e-9, `avviker vid index ${index}`);
  }
});

test('the rolling averages and bands match the one shot versions', () => {
  const history = series(Array.from({ length: 300 }, (_, i) => 100 + Math.cos(i / 11) * 8));
  const sma = calculateSmaSeries(history, 125);
  const bands = calculateLowerBandSeries(history, 20, 2);

  assert.ok(Math.abs(sma[200]! - calculateSmaSeries(history.slice(0, 201), 125).at(-1)!) < 1e-9);
  assert.ok(Math.abs(bands[200]! - calculateLowerBandSeries(history.slice(0, 201), 20, 2).at(-1)!) < 1e-9);
});

test('rolling extremes only look backwards', () => {
  // Stiger till dag 200, faller sedan. Vid dag 200 far framtiden inte synas.
  const closes = Array.from({ length: 300 }, (_, i) => (i <= 200 ? 100 + i : 300 - i));
  const { highs, lows } = rollingExtremes(series(closes), 252);
  assert.equal(highs[200], 300);
  assert.equal(lows[200], 100);
  // Lagsta pa dag 299 ar 1, alltsa efter fallet.
  assert.equal(lows[299], 1);
});

test('a falling stock scores high and a rising one scores low', () => {
  const falling = series(Array.from({ length: 300 }, (_, i) => 300 - i * 0.8));
  const rising = series(Array.from({ length: 300 }, (_, i) => 100 + i * 0.8));

  const fallingScore = computeTechnicalScoreSeries(falling).at(-1)!;
  const risingScore = computeTechnicalScoreSeries(rising).at(-1)!;

  assert.ok(fallingScore >= 4, `fallande fick ${fallingScore}`);
  assert.equal(risingScore, 0);
  assert.ok(fallingScore <= MAX_TECHNICAL_SCORE);
});

test('the score is null until there is enough history', () => {
  const scores = computeTechnicalScoreSeries(series(Array.from({ length: 300 }, (_, i) => 100 + i)));
  assert.equal(scores[50], null);
  assert.notEqual(scores[280], null);
});

test('samples monthly rather than daily to avoid overlapping windows', () => {
  const history = series(Array.from({ length: 600 }, (_, i) => 200 - i * 0.1));
  const benchmark = series(Array.from({ length: 600 }, () => 100));
  const observations = collectObservations(history, benchmark, [20]);

  // Var 21:a dag, och bara dar bade poang och framtid finns.
  assert.ok(observations.length > 5 && observations.length < 30, `fick ${observations.length}`);
  const gaps = observations.slice(1).map((o, i) => o.index - observations[i].index);
  assert.ok(gaps.every((gap) => gap % 21 === 0));
});

test('measures the stock against the index, not on its own', () => {
  // Aktien +10 %, index +10 %: ingen overavkastning.
  const history = series(Array.from({ length: 400 }, (_, i) => 100 * 1.1 ** (i / 400)));
  const benchmark = series(Array.from({ length: 400 }, (_, i) => 50 * 1.1 ** (i / 400)));
  const observations = collectObservations(history, benchmark, [20]);

  for (const observation of observations) {
    const value = observation.forwardAbnormal[20];
    if (value != null) assert.ok(Math.abs(value) < 0.01, `overavkastning ${value}`);
  }
});

test('the edge is measured against the baseline, not against zero', () => {
  const observations = [
    { index: 0, date: '2020-01-01', score: 7, forwardAbnormal: { 60: 1 } },
    { index: 21, date: '2020-02-01', score: 7, forwardAbnormal: { 60: 1 } },
    { index: 42, date: '2020-03-01', score: 0, forwardAbnormal: { 60: 5 } },
    { index: 63, date: '2020-04-01', score: 0, forwardAbnormal: { 60: 5 } },
  ];
  const result = aggregateObservations(observations, 1, [60]);
  const strong = result.buckets.find((bucket) => bucket.minScore === 6)!;

  // Starkt rekyllage ger +1 %, men snittet ar +3 %. Kanten ar alltsa negativ.
  assert.equal(result.baseline[60]!.mean, 3);
  assert.equal(edgeOverBaseline(strong, result.baseline, 60), -2);
});
