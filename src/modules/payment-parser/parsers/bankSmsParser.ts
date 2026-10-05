import { RawNotificationEvent } from "@native/payment-notification-listener";
import { NotificationParser, ParsedPayment } from "../types";
import {
  extractAmountPaise,
  normalizeNotificationText,
} from "../amountUtils";

/**
 * Bank credit alerts, which on most phones arrive as an SMS shown by the
 * messaging app rather than as a notification from a UPI app. A UPI payment
 * into a savings account often produces *only* this.
 *
 * Wording varies by bank, so both common shapes are accepted:
 *   "Received Rs.1.00 from FARHAN AHMAD ... UPI Ref 123456789012" (Kotak)
 *   "Your a/c XX1234 is credited with INR 500.00 ..."             (ICICI, SBI)
 *
 * Anything that looks like money going out is rejected outright: a debit
 * announced as income is far worse than a missed announcement.
 */
const OUTGOING = /\bdebited\b|\bsent to\b|\bpaid to\b|\bwithdrawn\b|\bspent\b|\bdebit\b/i;
const INCOMING = /\bcredited\b|\bcredit of\b|\breceived\b|\bdeposited\b/i;

/** Names in bank SMS are upper case, and the sentence ends at "on"/"via"/"Ref". */
const PAYER = /\bfrom\s+([A-Za-z][A-Za-z.\s]{1,40}?)(?=\s+(?:on|via|to|ref|upi|a\/c|acct|account|\d)|[.,]|$)/i;
const REFERENCE =
  /(?:UPI\s*Ref(?:erence)?\s*(?:No\.?)?|Ref(?:erence)?\s*(?:No\.?)?|UTR)[\s:.]*([A-Za-z0-9]{6,})/i;

export function parseBankSmsNotification(
  event: RawNotificationEvent,
): ParsedPayment | null {
  const text = normalizeNotificationText(
    [event.title, event.bigText ?? event.text, event.subText]
      .filter(Boolean)
      .join(" "),
  );
  if (!text) return null;

  if (OUTGOING.test(text)) return null;
  if (!INCOMING.test(text)) return null;

  const amount = extractAmountPaise(text);
  if (amount === null || amount === 0) return null;

  const payerMatch = text.match(PAYER);
  const refMatch = text.match(REFERENCE);

  return {
    amount,
    currency: "INR",
    payer: payerMatch ? payerMatch[1].trim() : null,
    source: "bank_sms",
    paymentType: "incoming",
    transactionId: refMatch ? refMatch[1] : null,
    status: "success",
  };
}

export const bankSmsParser: NotificationParser = {
  source: "bank_sms",
  // Filled in at runtime from the phone's default SMS app, so nothing has to
  // be typed in by hand.
  packageNames: [],
  parse: parseBankSmsNotification,
};
