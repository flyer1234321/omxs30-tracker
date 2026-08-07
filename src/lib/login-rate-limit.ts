const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 30 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

interface AttemptRecord {
  firstAttemptAt: number;
  failures: number;
  blockedUntil?: number;
}

export class LoginRateLimiter {
  private readonly records = new Map<string, AttemptRecord>();

  check(key: string, now = Date.now()) {
    const record = this.records.get(key);
    if (!record) return { allowed: true as const };
    if (record.blockedUntil && record.blockedUntil > now) {
      return { allowed: false as const, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    if (now - record.firstAttemptAt > ATTEMPT_WINDOW_MS) this.records.delete(key);
    return { allowed: true as const };
  }

  recordFailure(key: string, now = Date.now()) {
    const existing = this.records.get(key);
    const record = !existing || now - existing.firstAttemptAt > ATTEMPT_WINDOW_MS
      ? { firstAttemptAt: now, failures: 1 }
      : { ...existing, failures: existing.failures + 1 };

    if (record.failures >= MAX_FAILED_ATTEMPTS) record.blockedUntil = now + LOCKOUT_MS;
    this.records.set(key, record);
    return this.check(key, now);
  }

  reset(key: string) {
    this.records.delete(key);
  }
}

export const loginRateLimiter = new LoginRateLimiter();
