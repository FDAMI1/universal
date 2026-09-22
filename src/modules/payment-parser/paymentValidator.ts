import { ParsedPayment } from "./types";
import { RawNotificationEvent } from "@native/payment-notification-listener";

// Phrases that mean a notification is NOT a real incoming payment, even if
// it superficially mentions an amount — recharge confirmations, OTPs, and
// promotional pushes from payment apps are the main false-positive sources.
const REJECT_PATTERNS: RegExp[] = [
  /otp/i,
  /one[\s-]?time password/i,
  /recharge/i,
  /cashback/i,
  /offer/i,
  /\bwon\b/i,
  /balance\s+(is|alert|low)/i,
  /minimum\s+balance/i,
  /reminder/i,
  /request(?:ed)?\s+(money|₹|Rs\.?|INR)/i, // a payment REQUEST, not a completed payment
  /failed/i,
  /declined/i,
  /pending/i,
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Module 3 (Payment Validator): accept only successful incoming payments;
 * reject everything else the parser might have matched on (failed/pending
 * payments, outgoing payments, recharges, promos, OTPs, balance alerts).
 */
export function validatePayment(
  payment: ParsedPayment,
  event: RawNotificationEvent,
): ValidationResult {
  if (payment.paymentType !== "incoming") {
    return { valid: false, reason: "not an incoming payment" };
  }
  if (payment.status !== "success") {
    return {
      valid: false,
      reason: `payment status is "${payment.status}", not "success"`,
    };
  }
  if (payment.amount <= 0) {
    return { valid: false, reason: "amount is zero or invalid" };
  }

  const text = [event.title, event.text, event.bigText, event.subText]
    .filter(Boolean)
    .join(" ");
  const rejected = REJECT_PATTERNS.find((pattern) => pattern.test(text));
  if (rejected) {
    return { valid: false, reason: `matched reject pattern: ${rejected}` };
  }

  return { valid: true };
}
