/**
 * Tolkar det användaren skriver i ett filterfält.
 *
 * Svenska tangentbord ger decimalkomma. `Number('3,5')` blir NaN, och en NaN
 * i filtret jämförs alltid till falskt - resultatet blev en tom tabell utan
 * någon förklaring. Här översätts komma till punkt, och ofullständig inmatning
 * ("3,", "-") behandlas som "inget värde än" istället för som ett trasigt tal.
 */
export function parseNumericInput(raw: string): number | undefined {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized || normalized === '.' || normalized === '-' || normalized.endsWith('.')) return undefined;

  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** Visar ett tal i fältet med svenskt decimaltecken. */
export function formatNumericInput(value: number | undefined) {
  return value != null ? String(value).replace('.', ',') : '';
}
