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
  assert.equal(alerts[0].reasons.length, 4);
  assert.equal(isUrgentLiveAlert(alerts[0]), true);
});

test('does not create a buy alert from one condition', () => {
  // Bara ett villkor kvar: A-betyg efter en veckodipp.
  const alerts = evaluateAlerts({ ...base, sma200: 110, rsi: 45, previousRsi: 45 });
  assert.deepEqual(alerts, []);
});

test('reports a stock retaking its long term average as a buy condition', () => {
  const alerts = evaluateAlerts({
    ...base, sma200: 99.5, previousSma200: 99.5, previousClose: 99, rsi: 45, previousRsi: 45,
  });
  assert.deepEqual(alerts.map((alert) => alert.type), ['BUY']);
  assert.match(alerts[0].reasons.join(' '), /över SMA200/);
});

test('adds a caution line when a report is due within days', () => {
  const alerts = evaluateAlerts({ ...base, earningsInDays: 2 });
  assert.match(alerts[0].reasons.at(-1)!, /rapport om 2 dagar/i);
});

test('leaves the reasons untouched when the report is far away', () => {
  const alerts = evaluateAlerts({ ...base, earningsInDays: 30 });
  assert.equal(alerts[0].reasons.some((reason) => reason.startsWith('Obs')), false);
});

test('prioritizes a sell warning over a conflicting buy condition', () => {
  const alerts = evaluateAlerts({ ...base, rsi: 81, previousRsi: 79, price: 99, threeDayChangePct: 16 });
  assert.deepEqual(alerts.map((alert) => alert.type), ['SELL']);
  assert.match(alerts[0].reasons.join(' '), /brott ned genom kort trend/);
  assert.equal(isUrgentLiveAlert(alerts[0]), true);
});
