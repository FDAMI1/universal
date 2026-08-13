import { RawNotificationEvent } from "@native/payment-notification-listener";
import { NotificationParser, ParsedPayment } from "../types";
import { extractAmountPaise, looksLikeIncomingPayment } from "../amountUtils";

/**
 * UNVERIFIED wording — built from the generally-known shape of Google Pay
 * payment alerts ("<payer> paid you ₹500"), not a confirmed current sample.
 * Capture real notification text via the Logs screen (Phase 2's raw
 * capture) and correct this regex before relying on it for real
 * announcements. The same package is used for both personal and business
 * Google Pay, so `source` is decided by the caller (see index.ts) based on
 * the user's own configuration, not by this parser.
 */
export function parseGooglePayNotification(
  event: RawNotificationEvent,
): ParsedPayment | null {
  const text = [event.title, event.bigText ?? event.text, event.subText]
    .filter(Boolean)
    .join(" ");
  if (!text) return null;

  const amount = extractAmountPaise(text);
  if (amount === null) return null;

  const paidYouMatch = text.match(/^([A-Za-z0-9.\s]{2,40}?)\s+paid you/i);
  const isIncoming = Boolean(paidYouMatch) || looksLikeIncomingPayment(text);
  if (!isIncoming) return null;

  const txnMatch = text.match(/(?:UPI transaction ID|txn)[\s:]*([A-Za-z0-9]{6,})/i);

  return {
    amount,
    currency: "INR",
    payer: paidYouMatch ? paidYouMatch[1].trim() : null,
    source: "google_pay",
    paymentType: "incoming",
    transactionId: txnMatch ? txnMatch[1] : null,
    status: "success",
  };
}

export const googlePayParser: NotificationParser = {
  source: "google_pay",
  packageNames: ["com.google.android.apps.nbu.paisa.user"],
  parse: parseGooglePayNotification,
};
