import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAlerts, isUrgentLiveAlert, type AlertSnapshot } from './alert-engine';

const base: AlertSnapshot = {
  ticker: 'TEST.ST', companyName: 'Test AB', price: 100, previousClose: 102, rsi: 28, previousRsi: 26,
  sma20: 102, previousSma20: 101, sma50: 105, previousSma50: 101, sma200: 100.5, previousSma200: 99,
  volumeRatio: 1, weeklyChangePct: -6, threeDayChangePct: -2, grade: 'A',
};

test('requires at least two buy conditions', () => {
  const alerts = evaluateAlerts(base);
  assert.deepEqual(alerts.map((alert) => alert.type), ['BUY']);
  assert.equal(alerts[0].reasons.length, 3);
  assert.equal(isUrgentLiveAlert(alerts[0]), true);
});

test('does not create a buy alert from one condition', () => {
  const alerts = evaluateAlerts({ ...base, sma200: 110, grade: 'B', weeklyChangePct: -2 });
  assert.deepEqual(alerts, []);
});

test('prioritizes a sell warning over a conflicting buy condition', () => {
  const alerts = evaluateAlerts({ ...base, rsi: 81, previousRsi: 79, price: 99, threeDayChangePct: 16 });
  assert.deepEqual(alerts.map((alert) => alert.type), ['SELL']);
  assert.match(alerts[0].reasons.join(' '), /brott ned genom kort trend/);
  assert.equal(isUrgentLiveAlert(alerts[0]), true);
});
