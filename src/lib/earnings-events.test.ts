import assert from 'node:assert/strict';
import test from 'node:test';
import { quarterCandidates } from './earnings-events';

test('uses quarterly statements when analyst surprise history is missing', () => {
  const candidates = quarterCandidates({
    incomeStatementHistoryQuarterly: {
      incomeStatementHistory: [{ endDate: new Date('2026-06-30T00:00:00Z') }],
    },
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].period, 'Q2 2026');
  assert.equal(candidates[0].surprisePercent, null);
});

test('prefers analyst surprise data for the same quarter', () => {
  const quarter = new Date('2026-06-30T00:00:00Z');
  const candidates = quarterCandidates({
    earningsHistory: { history: [{ quarter, period: 'Q2 2026', epsActual: 2, epsEstimate: 1.8, surprisePercent: 0.111 }] },
    incomeStatementHistoryQuarterly: { incomeStatementHistory: [{ endDate: quarter }] },
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].surprisePercent, 11.1);
});
