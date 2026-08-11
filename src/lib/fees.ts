// Transaction fee helpers for the Syncletics monetization model.
// The platform charges a per-transaction fee on each member payment:
//   fee = round(amountCents * feePercentBps / 10000) + feeFixedCents
// Basis points (bps) avoid floating point drift: 250 bps = 2.50%.

export interface FeeConfig {
  feePercentBps: number;
  feeFixedCents: number;
}

export const DEFAULT_FEE: FeeConfig = {
  feePercentBps: 250,
  feeFixedCents: 30,
};

/**
 * Compute the fee (in cents) charged on a payment of `amountCents`.
 *
 * Guards two cases the naive formula gets wrong:
 *  - a zero, negative or non-finite amount must not attract the fixed fee
 *    (a $0 invoice was being charged $0.30, and net revenue went negative);
 *  - the fee can never exceed the amount collected.
 */
export function computeFeeCents(amountCents: number, cfg: FeeConfig): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const pct = Math.round((amountCents * (cfg.feePercentBps ?? 0)) / 10000);
  return Math.min(amountCents, pct + (cfg.feeFixedCents ?? 0));
}

/** Amount the club nets after the fee is deducted. */
export function computeNetCents(amountCents: number, cfg: FeeConfig): number {
  return amountCents - computeFeeCents(amountCents, cfg);
}

/** Full split for a transaction. */
export function splitTransaction(amountCents: number, cfg: FeeConfig) {
  const fee = computeFeeCents(amountCents, cfg);
  return { amountCents, feeCents: fee, netCents: amountCents - fee };
}

/** Human-readable description, e.g. "2.5% + $0.30". */
export function describeFee(cfg: FeeConfig, currency = "$"): string {
  const pct = (cfg.feePercentBps / 100).toFixed(2).replace(/\.?0+$/, "");
  const fixed = (cfg.feeFixedCents / 100).toFixed(2);
  return `${pct}% + ${currency}${fixed}`;
}
