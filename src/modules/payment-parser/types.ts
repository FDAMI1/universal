import { PaymentObject, PaymentSource } from "@shared/types/payment";
import { RawNotificationEvent } from "@native/payment-notification-listener";

/** What a parser produces for a notification it recognizes. `null` fields on
 * `payment` are allowed (e.g. no transaction ID) — but the parser must be
 * certain this notification IS a payment before returning anything at all.
 * When unsure, return null from `parse` so the validator/parser-chain can
 * decide, rather than guessing. */
export type ParsedPayment = Omit<PaymentObject, "deviceId" | "timestamp">;

export interface NotificationParser {
  source: PaymentSource;
  /** Package name(s) this parser knows how to read. */
  packageNames: string[];
  /** Returns null when the notification doesn't match this parser's known
   * shapes at all (wrong text pattern) — distinct from matching but being a
   * non-payment notification (e.g. "low balance"), which the parser should
   * still return a ParsedPayment for with status a validator will reject,
   * OR return null for if it's confidently not payment-related. Either is
   * acceptable; the validator (Phase 4b) is the final authority. */
  parse(event: RawNotificationEvent): ParsedPayment | null;
}
