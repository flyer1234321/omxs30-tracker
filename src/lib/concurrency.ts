/**
 * Kör uppgifterna med ett tak för hur många som pågår samtidigt.
 *
 * Yahoo Finance är ett inofficiellt gratis-API som stryper trafik per IP. Ett
 * tak håller hämtningen snabb utan att se ut som en skrapare.
 */
export async function mapWithConcurrency<Input, Output>(
  items: Input[],
  limit: number,
  worker: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const results: Output[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index]);
    return runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}
