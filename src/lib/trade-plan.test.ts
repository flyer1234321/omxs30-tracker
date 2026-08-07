import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTradePlan, positionSizeForRisk } from './trade-plan';

const base = {
  currentPrice: 100,
  atr: 2,
  sma50: 90,
  sma125: 86,
  sma200: 82,
  fiftyTwoWeekHigh: 112,
  fiftyTwoWeekLow: 70,
};

test('places the stop two ATR below the price and targets the nearest resistance', () => {
  const plan = buildTradePlan(base);
  assert.ok(plan);
  assert.equal(plan.stopLoss, 96);
  assert.equal(plan.target, 112);
  assert.equal(Math.round(plan.riskPercent), 4);
  assert.equal(Math.round(plan.rewardPercent), 12);
  assert.equal(Number(plan.rMultiple.toFixed(1)), 3);
});

test('prefers a moving average that sits right at the volatility stop', () => {
  const plan = buildTradePlan({ ...base, sma50: 96.2 });
  assert.ok(plan);
  // SMA 50 ligger inom en procent fran 2 x ATR-nivan, sa stoppen laggs strax under den.
  assert.equal(Number(plan.stopLoss.toFixed(3)), 95.719);
  assert.match(plan.stopBasis, /SMA 50/);
});

test('falls back to an ATR target when no resistance is near', () => {
  const plan = buildTradePlan({ ...base, fiftyTwoWeekHigh: 400 });
  assert.ok(plan);
  assert.equal(plan.target, 106);
  assert.match(plan.targetBasis, /ATR/);
});

test('returns nothing when volatility is unknown', () => {
  assert.equal(buildTradePlan({ ...base, atr: null }), null);
});

test('converts a risk budget into a number of shares', () => {
  const plan = buildTradePlan(base);
  assert.ok(plan);
  // 4 kronor risk per aktie, 1000 kronor att riskera.
  assert.equal(positionSizeForRisk(plan, 1000), 250);
});
