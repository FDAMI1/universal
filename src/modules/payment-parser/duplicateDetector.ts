import { ParsedPayment } from "./types";

interface RecentPaymentRecord {
  amount: number;
  source: string;
  transactionId: string | null;
  seenAtMillis: number;
}

/**
 * Module 4 (Duplicate Detection): the same payment can trigger more than one
 * notification (e.g. a banner + a status-bar update), so this suppresses
 * repeats within a configurable window rather than announcing each one.
 *
 * Kept as a small class instead of module-level state so it can be
 * instantiated fresh in tests without leaking state between them.
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

    const isMatch = this.recent.some((record) => {
      if (record.amount !== payment.amount) return false;
      // Two IDs that differ mean two genuinely separate payments of the same
      // amount; one missing ID means amount within the window is all we have.
      if (payment.transactionId && record.transactionId) {
        return payment.transactionId === record.transactionId;
      }
      // Deliberately NOT matched on source: one sale is commonly reported
      // twice, by the payment app and again by the bank's SMS, and the shop
      // should hear it once.
      return true;
    });

    this.recent.push({
      amount: payment.amount,
      source: payment.source,
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
