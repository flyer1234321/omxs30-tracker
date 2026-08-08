import assert from 'node:assert/strict';
import test from 'node:test';
import { decideAccess, type AppUserRecord } from './app-users';

function user(email: string, overrides: Partial<AppUserRecord> = {}): AppUserRecord {
  return { email, isAdmin: false, canUseAi: false, aiDailyLimit: 0, createdAt: null, disabledAt: null, ...overrides };
}

test('an administrator in the environment always gets in', () => {
  // Aven nar tabellen sager nej, sa att sista administratoren inte kan lasas ute.
  const decision = decideAccess('chef@example.com', [user('annan@example.com')], ['chef@example.com'], []);
  assert.equal(decision.allowed, true);
  assert.equal(decision.isAdmin, true);
  assert.equal(decision.canUseAi, true);
  assert.equal(decision.source, 'env-admin');
});

test('the table decides once it has rows', () => {
  const users = [user('a@example.com', { canUseAi: true }), user('b@example.com')];
  assert.deepEqual(decideAccess('a@example.com', users, [], []), {
    allowed: true, isAdmin: false, canUseAi: true, aiDailyLimit: 0, source: 'database',
  });
  assert.equal(decideAccess('okand@example.com', users, [], []).allowed, false);
});

test('a disabled account is refused even though the row exists', () => {
  const users = [user('a@example.com', { canUseAi: true, disabledAt: '2026-01-01T00:00:00.000Z' })];
  const decision = decideAccess('a@example.com', users, [], []);
  assert.equal(decision.allowed, false);
  assert.equal(decision.canUseAi, false);
});

test('an empty table falls back to the environment allowlist', () => {
  const decision = decideAccess('a@example.com', [], [], ['a@example.com']);
  assert.equal(decision.allowed, true);
  assert.equal(decision.source, 'env-fallback');
  // Alla hade AI innan behorigheterna flyttades, och det beteendet behalls.
  assert.equal(decision.canUseAi, true);
});

test('an unreadable table does not lock everyone out', () => {
  // null betyder att databasen inte svarade, till skillnad fran tom lista.
  const decision = decideAccess('a@example.com', null, [], ['a@example.com']);
  assert.equal(decision.allowed, true);
  assert.equal(decision.source, 'env-fallback');
  assert.equal(decideAccess('b@example.com', null, [], ['a@example.com']).allowed, false);
});

test('no allowlist anywhere means the app is open, as before', () => {
  assert.equal(decideAccess('vemsomhelst@example.com', [], [], []).allowed, true);
});

test('email matching ignores case and surrounding spaces', () => {
  const users = [user('a@example.com', { isAdmin: true })];
  assert.equal(decideAccess('  A@Example.COM ', users, [], []).isAdmin, true);
});

test('a missing email is refused when the table is in charge', () => {
  assert.equal(decideAccess(null, [user('a@example.com')], [], []).allowed, false);
});

test('the database supplies the configured daily AI limit', () => {
  const decision = decideAccess('a@example.com', [user('a@example.com', { canUseAi: true, aiDailyLimit: 4 })], [], []);
  assert.equal(decision.aiDailyLimit, 4);
});
