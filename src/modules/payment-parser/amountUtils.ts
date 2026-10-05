/** Digits with no compatibility mapping, so NFKC leaves them alone. */
const DIGIT_ALIASES: Record<string, string> = {
  // Devanagari ०-९
  "\u0966": "0", "\u0967": "1", "\u0968": "2", "\u0969": "3", "\u096a": "4",
  "\u096b": "5", "\u096c": "6", "\u096d": "7", "\u096e": "8", "\u096f": "9",
  // Arabic-Indic ٠-٩
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4",
  "\u0665": "5", "\u0666": "6", "\u0667": "7", "\u0668": "8", "\u0669": "9",
};

/**
 * Puts notification text into a form the patterns can read.
 *
 * Payment apps don't always use ordinary digits. PhonePe Business writes
 * amounts with mathematical double-struck ones — "You've received Rs.𝟙" is
 * U+1D7D9, not the digit 1 — which silently matched nothing and made every
 * such payment look like it had no amount at all. NFKC folds those (and
 * full-width and styled variants) back to ASCII; the few scripts with no
 * compatibility mapping are listed above. Non-breaking spaces go too, since
 * they appear between the currency symbol and the number.
 */
export function normalizeNotificationText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u0966-\u096f\u0660-\u0669]/g, (d) => DIGIT_ALIASES[d] ?? d)
    .replace(/[\u00a0\u2007\u202f\u2009]/g, " ");
}

/**
 * Extracts an Indian Rupee amount from free-form notification text and
 * returns it as integer paise (never a float rupee amount, to avoid
 * rounding errors on money). Handles "₹1,234.50", "Rs. 500", "INR 45".
 */
export function extractAmountPaise(rawText: string): number | null {
  const text = normalizeNotificationText(rawText);
  const match = text.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;

  const numeric = match[1].replace(/,/g, "");
  const rupees = Number.parseFloat(numeric);
  if (!Number.isFinite(rupees) || rupees < 0) return null;

  return Math.round(rupees * 100);
}

/** True when the text describes money moving IN (received/credited), as
 * opposed to OUT (sent/paid/debited). Source-specific parsers should prefer
 * their own stronger signals when available; this is a generic fallback. */
export function looksLikeIncomingPayment(text: string): boolean {
  const lower = normalizeNotificationText(text).toLowerCase();
  const incomingSignals = ["received", "credited", "credit of", "you received"];
  const outgoingSignals = ["sent", "paid", "debited", "you paid", "payment of"];

  const hasIncoming = incomingSignals.some((s) => lower.includes(s));
  const hasOutgoing = outgoingSignals.some((s) => lower.includes(s));

  return hasIncoming && !hasOutgoing;
}
