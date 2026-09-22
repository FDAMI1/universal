import { RawNotificationEvent } from "@native/payment-notification-listener";
import { NotificationParser, ParsedPayment } from "../types";
import { extractAmountPaise, looksLikeIncomingPayment } from "../amountUtils";

/**
 * UNVERIFIED wording — built from the generally-known shape of Paytm
 * Business payment alerts ("Payment received ₹500 from <payer>"), not a
 * confirmed current sample. Capture real notification text via the Logs
 * screen (Phase 2's raw capture) and correct this regex before relying on
 * it for real announcements.
 */
export const paytmBusinessParser: NotificationParser = {
  source: "paytm_business",
  packageNames: ["net.one97.paytm", "com.paytm.business"],

  parse(event: RawNotificationEvent): ParsedPayment | null {
    const text = [event.title, event.bigText ?? event.text, event.subText]
      .filter(Boolean)
      .join(" ");
    if (!text) return null;

    const amount = extractAmountPaise(text);
    if (amount === null) return null;
    if (!looksLikeIncomingPayment(text)) return null;

    const payerMatch = text.match(
      /from\s+([A-Za-z0-9.\s]{2,40}?)(?:\.|$|\s+via)/i,
    );
    const txnMatch = text.match(
      /(?:order id|txn|transaction)[\s:]*([A-Za-z0-9]{6,})/i,
    );

    return {
      amount,
      currency: "INR",
      payer: payerMatch ? payerMatch[1].trim() : null,
      source: "paytm_business",
      paymentType: "incoming",
      transactionId: txnMatch ? txnMatch[1] : null,
      status: "success",
    };
  },
};
