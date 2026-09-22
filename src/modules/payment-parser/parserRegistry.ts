import { RawNotificationEvent } from "@native/payment-notification-listener";
import { ParsedPayment, NotificationParser } from "./types";
import { phonePeBusinessParser } from "./parsers/phonePeBusinessParser";
import { paytmBusinessParser } from "./parsers/paytmBusinessParser";
import { googlePayParser } from "./parsers/googlePayParser";
import { bankSmsParser } from "./parsers/bankSmsParser";

const PARSERS: NotificationParser[] = [
  phonePeBusinessParser,
  paytmBusinessParser,
  googlePayParser,
  bankSmsParser,
];

/**
 * Finds the parser registered for a package and runs it. Google Pay's single
 * package serves both personal and business use — `treatGooglePayAsPersonal`
 * (from user Settings, since only the user knows which they use) relabels
 * the parsed source accordingly rather than trying to detect it from text.
 */
export function parseNotification(
  event: RawNotificationEvent,
  options: { treatGooglePayAsPersonal?: boolean; smsPackageName?: string } = {},
): ParsedPayment | null {
  if (options.smsPackageName && event.packageName === options.smsPackageName) {
    return bankSmsParser.parse(event);
  }

  const parser = PARSERS.find((p) =>
    p.packageNames.includes(event.packageName),
  );
  if (!parser) return null;

  const result = parser.parse(event);
  if (
    result &&
    parser === googlePayParser &&
    options.treatGooglePayAsPersonal
  ) {
    return { ...result, source: "google_pay_personal" };
  }
  return result;
}

export function getRegisteredParsers(): readonly NotificationParser[] {
  return PARSERS;
}
