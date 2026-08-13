/** Parses the minimum-amount text input (rupees, possibly with decimals)
 * into integer paise. Invalid or negative input falls back to 0 (no
 * minimum) rather than rejecting the edit outright. */
export function parseMinimumAmountInput(text: string): number {
  const rupees = Number.parseFloat(text);
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  return Math.round(rupees * 100);
}

/** Parses the duplicate-timeout text input (whole seconds). Invalid or
 * negative input falls back to the PDR's default of 30s. */
export function parseDuplicateTimeoutInput(text: string): number {
  const seconds = Number.parseInt(text, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return 30;
  return seconds;
}
