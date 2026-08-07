import assert from 'node:assert/strict';
import test from 'node:test';

process.env.APP_ACCESS_PASSWORD = 'correct-horse-battery-staple';
process.env.APP_SESSION_SECRET = 'a-very-long-random-session-secret-for-testing';

async function loadAuth() {
  return import('./app-auth');
}

test('creates a session cookie that is valid for the originating request', async () => {
  const auth = await loadAuth();
  const request = new Request('http://localhost:8081/api/auth');
  const cookie = auth.sessionCookie(request);
  const requestWithCookie = new Request('http://localhost:8081/api/analyze', { headers: { cookie } });
  assert.equal(auth.hasValidSession(requestWithCookie), true);
});

test('rejects an altered session cookie and uses timing-safe password comparison', async () => {
  const auth = await loadAuth();
  const request = new Request('http://localhost:8081/api/auth');
  const cookie = auth.sessionCookie(request);
  const [pair] = cookie.split(';');
  const [name, token] = pair.split('=');
  const alteredToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const requestWithCookie = new Request('http://localhost:8081/api/analyze', { headers: { cookie: `${name}=${alteredToken}` } });
  assert.equal(auth.hasValidSession(requestWithCookie), false);
  assert.equal(auth.passwordMatches('correct-horse-battery-staple'), true);
  assert.equal(auth.passwordMatches('wrong-password'), false);
});
