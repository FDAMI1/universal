import { ParsedPayment } from "./types";

interface RecentPaymentRecord {
  amount: number;
  payer: string | null;
  transactionId: string | null;
  seenAtMillis: number;
}

/** Upper case, single spaces: "Mohammed  Abdullah" and "MOHAMMED ABDULLAH"
 * are the same customer written by two different apps. */
function normalizePayer(payer: string | null): string | null {
  if (!payer) return null;
  const cleaned = payer.trim().replace(/\s+/g, " ").toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

/** One app often truncates the name the other spells out, so a prefix counts
 * as the same person: "MOHAMMED ABDULLAH" vs "MOHAMMED ABDULLAH SHARIF A". */
function samePayer(a: string, b: string): boolean {
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Suppresses repeats of one payment without silencing a second genuine sale.
 *
 * A single payment is announced by several things at once: PhonePe posts the
 * same notification two to four times, and the bank's SMS reports it again. So
 * repeats must be swallowed. But in a shop two customers paying the same
 * amount moments apart is ordinary, and losing the second sale is far worse
 * than announcing one twice — so identity is decided on the strongest signal
 * each pair of payments shares:
 *
 *   both carry a transaction ID -> the IDs must match
 *   both name the payer         -> amount and payer must match
 *   neither                     -> amount alone, inside the window
 */
export class DuplicateDetector {
  private recent: RecentPaymentRecord[] = [];

  constructor(private windowMs: number) {}

  setWindowMs(windowMs: number): void {
    this.windowMs = windowMs;
  }

  /** Returns true if this payment duplicates one seen within the window,
   *  and records this payment as seen either way. */
  isDuplicate(payment: ParsedPayment, nowMillis: number): boolean {
    this.evictExpired(nowMillis);
    const payer = normalizePayer(payment.payer);

    const isMatch = this.recent.some((record) => {
      if (record.amount !== payment.amount) return false;
      if (payment.transactionId && record.transactionId) {
        return payment.transactionId === record.transactionId;
      }
      if (payer && record.payer) {
        return samePayer(payer, record.payer);
      }
      return true;
    });

    this.recent.push({
      amount: payment.amount,
      payer,
      transactionId: payment.transactionId,
      seenAtMillis: nowMillis,
    });

    return isMatch;
  }

  private evictExpired(nowMillis: number): void {
    this.recent = this.recent.filter(
      (record) => nowMillis - record.seenAtMillis <= this.windowMs,
    );
  }
}
