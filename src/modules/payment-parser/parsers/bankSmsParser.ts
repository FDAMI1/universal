import { RawNotificationEvent } from "@native/payment-notification-listener";
import { NotificationParser, ParsedPayment } from "../types";
import { extractAmountPaise } from "../amountUtils";

/**
 * UNVERIFIED wording — bank SMS credit-alert formats vary significantly
 * between banks (ICICI, HDFC, SBI, etc. all phrase these differently) and
 * this project's PDR lists only ICICI as a confirmed target. Treat this as
 * a starting point, not a validated parser, until tested against real SMS
 * text from the specific bank(s) in use.
 *
 * The SMS app's package name is device/OEM-dependent (Google Messages,
 * Samsung Messages, etc.) — the caller must configure the correct package
 * for the user's device in Settings rather than this module guessing one.
 */
export function parseBankSmsNotification(
  event: RawNotificationEvent,
): ParsedPayment | null {
  const text = [event.title, event.bigText ?? event.text, event.subText]
    .filter(Boolean)
    .join(" ");
  if (!text) return null;

  // Bank credit alerts consistently use "credited" for money coming in;
  // "debited" for money going out. Reject anything not explicitly a credit.
  if (!/credited/i.test(text)) return null;
  if (/debited/i.test(text)) return null;

  const amount = extractAmountPaise(text);
  if (amount === null) return null;

  const refMatch = text.match(/(?:Ref(?:erence)?\s*(?:No\.?)?|UTR)[\s:]*([A-Za-z0-9]{6,})/i);

  return {
    amount,
    currency: "INR",
    payer: null,
    source: "bank_sms",
    paymentType: "incoming",
    transactionId: refMatch ? refMatch[1] : null,
    status: "success",
  };
}

export const bankSmsParser: NotificationParser = {
  source: "bank_sms",
  // No default — the SMS app package is set per-device via Settings.
  packageNames: [],
  parse: parseBankSmsNotification,
};
