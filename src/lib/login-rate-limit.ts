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

/**
 * Utskick av inloggningslänkar hade ingen spärr alls. Supabase inbyggda
 * e-postutskick ligger på ett par mejl i timmen på gratisnivån, så några
 * snabba klick på "Skicka" räckte för att bränna kvoten och göra inloggningen
 * omöjlig en stund framåt.
 *
 * Observera att räknaren lever i minnet per serverinstans. Den stoppar
 * oavsiktlig upprepning och enkel spam, men är inte ett skydd mot en angripare
 * med många IP-adresser. För det krävs en delad räknare i databasen.
 */
export class CooldownLimiter {
  private readonly records = new Map<string, number[]>();

  constructor(
    private readonly cooldownMs: number,
    private readonly maxPerWindow: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()) {
    const timestamps = (this.records.get(key) || []).filter((at) => now - at < this.windowMs);

    const last = timestamps.at(-1);
    if (last != null && now - last < this.cooldownMs) {
      return { allowed: false as const, retryAfterSeconds: Math.ceil((this.cooldownMs - (now - last)) / 1000) };
    }
    if (timestamps.length >= this.maxPerWindow) {
      const oldest = timestamps[0];
      return { allowed: false as const, retryAfterSeconds: Math.ceil((this.windowMs - (now - oldest)) / 1000) };
    }
    return { allowed: true as const };
  }

  record(key: string, now = Date.now()) {
    const timestamps = (this.records.get(key) || []).filter((at) => now - at < this.windowMs);
    timestamps.push(now);
    this.records.set(key, timestamps);
  }
}

/** Per e-postadress: en länk i minuten, högst fem i timmen. */
export const magicLinkEmailLimiter = new CooldownLimiter(60 * 1000, 5, 60 * 60 * 1000);

/** Per IP-adress: högst tio utskick i timmen, oavsett adress. */
export const magicLinkClientLimiter = new CooldownLimiter(0, 10, 60 * 60 * 1000);
