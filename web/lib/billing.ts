// Pure payment helpers - no imports, so they can be unit tested in isolation
// (see tests/billing.test.ts).

/** Paystack amounts are in the smallest currency unit: KES cents, not shillings. */
export function toMinorUnits(amountMajor: number | string): number {
  return Math.round(Number(amountMajor) * 100);
}

/**
 * Does what Paystack says was paid match what our own `payments` row says we
 * asked for? Our row is the source of truth for price - never grant access
 * for an amount or currency we didn't request.
 */
export function paymentMatches(
  expected: { amount: number | string; currency: string },
  paid: { amount: number | undefined; currency: string | undefined },
): boolean {
  return paid.amount === toMinorUnits(expected.amount) && paid.currency === expected.currency;
}

/** Early renewals extend from the current expiry instead of overwriting it, so no paid days are lost. */
export function nextPeriodEnd(existingEnd: string | Date | null | undefined, now: Date, days: number): Date {
  const existing = existingEnd ? new Date(existingEnd) : null;
  const base = existing && existing > now ? existing : now;
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Days (rounded up) left until `end`, or 0 if it has passed. */
export function daysRemaining(end: string | Date, now: Date = new Date()): number {
  const ms = new Date(end).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}
