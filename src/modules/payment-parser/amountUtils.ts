/**
 * Extracts an Indian Rupee amount from free-form notification text and
 * returns it as integer paise (never a float rupee amount, to avoid
 * rounding errors on money). Handles "₹1,234.50", "Rs. 500", "INR 45".
 */
export function extractAmountPaise(text: string): number | null {
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
  const lower = text.toLowerCase();
  const incomingSignals = ["received", "credited", "credit of", "you received"];
  const outgoingSignals = ["sent", "paid", "debited", "you paid", "payment of"];

  const hasIncoming = incomingSignals.some((s) => lower.includes(s));
  const hasOutgoing = outgoingSignals.some((s) => lower.includes(s));

  return hasIncoming && !hasOutgoing;
}
