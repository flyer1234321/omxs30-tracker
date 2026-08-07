import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVolumeBars, calculatePeriodPerformance, downsampleChartData } from './chart-presentation';

const history = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  close: 100 + index,
  volume: (index + 1) * 100,
}));

test('keeps the newest quote when downsampling chart data', () => {
  const sampled = downsampleChartData(history, 3);
  assert.equal(sampled.at(-1)?.close, 109);
  assert.ok(sampled.length <= 4);
});

test('calculates a period return from first to latest close', () => {
  assert.deepEqual(calculatePeriodPerformance(history), { absolute: 9, percent: 9 });
});

test('aggregates volume into compact bars', () => {
  assert.deepEqual(buildVolumeBars(history, 3), [250, 650, 950]);
});
