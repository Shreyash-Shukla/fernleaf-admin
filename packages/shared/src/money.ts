// ─── Money Utilities ────────────────────────────────────────────
// All money is integer cents. No floating-point anywhere.
// Max safe value: 100_000_000 cents = $1,000,000.

/**
 * Parse a dollar string or number to integer cents.
 * "$12.50" → 1250, 12.5 → 1250, 1250 (already cents if integer) — ambiguous,
 * so we assume the input is in dollars if it's a number with decimals.
 *
 * For safety, this function expects a string "$X.YY" or a number in dollars.
 */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === 'number') {
    // Round to avoid float issues: 12.50 → 1250
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (isNaN(num)) {
    throw new Error(`Invalid money value: "${input}"`);
  }
  return Math.round(num * 100);
}

/**
 * Format integer cents to a display string: 1250 → "$12.50"
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`;
}

/**
 * Multiply a base-cents value by a basis-points factor.
 * factorBps: 10000 = ×1.00
 * Result is NOT rounded — use roundUp5 separately if needed.
 *
 * Returns null if baseCents is 0 or negative (not orderable).
 */
export function mulBps(baseCents: number, factorBps: number): number | null {
  if (baseCents <= 0) return null;
  // Integer math: ceil(baseCents * factorBps / 10000)
  // But we need to go through the derive formula for 5-cent rounding
  return Math.ceil((baseCents * factorBps) / 10000);
}

/**
 * Round UP to next multiple of 5.
 * 211 → 215, 210 → 210, 1 → 5, 0 → 0.
 */
export function roundUp5(cents: number): number {
  return Math.ceil(cents / 5) * 5;
}

/**
 * Derive a price from a base value and a basis-points factor,
 * then round UP to next 5 cents.
 *
 * Formula: ceil(baseCents * factorBps / 50000) * 5
 *
 * factorBps:
 *   10000 = ×1.00 (100%)
 *   24000 = ×2.40
 *   11500 = ×1.15 (Standard + 15%)
 *
 * Returns null if baseCents <= 0 (not orderable).
 */
export function derive(baseCents: number, factorBps: number): number | null {
  if (baseCents <= 0) return null;
  // ceil(baseCents * factorBps / 50000) * 5
  return Math.ceil((baseCents * factorBps) / 50000) * 5;
}
