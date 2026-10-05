import { RawNotificationEvent } from "@native/payment-notification-listener";
import { ParsedPayment } from "../types";
import { extractAmountPaise } from "../amountUtils";

/**
 * Announces money arriving in *any* app, by reading the notification's words
 * rather than trusting a list of package names.
 *
 * Package names are unknowable in practice: Google Pay for Business, PhonePe
 * Business and Paytm for Business each ship under their own package, they get
 * renamed, and a shop may use an app nobody anticipated. A real ₹1 sale through
 * Google Pay for Business was missed for exactly this reason.
 *
 * The cost of guessing wrong is announcing something that isn't a sale, so the
 * rules are deliberately strict: there must be an amount, a phrase that means
 * money came IN, and nothing suggesting it went out or that this is marketing.
 */

/** Money leaving, or a request for money — never announced. */
const OUTGOING =
  /\b(debited|sent|paid to|you paid|spent|withdrawn|transfer(?:red)? to|requesting|has requested|requested money|is requesting|pay now|due|reminder|failed|declined|cancell?ed|pending|processing)\b/i;

/** Money arriving. Deliberately narrow — "credit card" must not qualify. */
const INCOMING =
  /\b(received|credited|credit of|you got|has paid you|paid you|payment received|received payment|deposited|added to your)\b/i;

/**
 * Marketing that borrows payment words: "You received 500 reward points",
 * "Get ₹100 cashback". These outnumber real payments on a busy phone.
 */
const PROMOTIONAL =
  /\b(cashback|reward|scratch card|offer|voucher|coupon|win|won|congratulations|lucky|discount|sale is live|shop now|refer|bonus|points|loan|emi|insurance|subscri|recharge now|invite)\b/i;

/** Notifications from these are never sales, whatever they say. */
const IGNORED_PACKAGES = [
  "android",
  "com.android.systemui",
  "com.android.settings",
  "com.whatsapp",
  "com.whatsapp.w4b",
  "org.telegram.messenger",
  "com.instagram.android",
  "com.facebook.katana",
  "com.google.android.gm",
  "com.google.android.youtube",
];

export function parseGenericIncomingPayment(
  event: RawNotificationEvent,
): ParsedPayment | null {
  if (IGNORED_PACKAGES.includes(event.packageName)) return null;

  const text = [event.title, event.bigText ?? event.text, event.subText]
    .filter(Boolean)
    .join(" ");
  if (!text) return null;

  if (OUTGOING.test(text)) return null;
  if (PROMOTIONAL.test(text)) return null;
  if (!INCOMING.test(text)) return null;

  const amount = extractAmountPaise(text);
  if (amount === null || amount === 0) return null;

  // "from NAME", up to the next clause. Names in payment notifications run to
  // the end of the sentence or to a keyword like "on", "via" or "UPI".
  const payer = text.match(
    /\bfrom\s+([A-Za-z][A-Za-z.\s]{1,40}?)(?=\s+(?:on|via|to|ref|upi|at|in|a\/c|acct|account|\d)|[.,!]|$)/i,
  );
  const reference = text.match(
    /(?:UPI\s*(?:Ref(?:erence)?|txn)?\s*(?:No\.?|ID)?|Ref(?:erence)?\s*(?:No\.?)?|UTR|Txn\s*ID)[\s:.#]*([A-Za-z0-9]{6,})/i,
  );

  return {
    amount,
    currency: "INR",
    payer: payer ? payer[1].trim() : null,
    source: "other_app",
    paymentType: "incoming",
    transactionId: reference ? reference[1] : null,
    status: "success",
  };
}
