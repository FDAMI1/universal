import { RawNotificationEvent } from "@native/payment-notification-listener";
import { ParsedPayment, NotificationParser } from "./types";
import { phonePeBusinessParser } from "./parsers/phonePeBusinessParser";
import { paytmBusinessParser } from "./parsers/paytmBusinessParser";
import { googlePayParser } from "./parsers/googlePayParser";
import { bankSmsParser } from "./parsers/bankSmsParser";
import { parseGenericIncomingPayment } from "./parsers/genericPaymentParser";

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
  options: {
    treatGooglePayAsPersonal?: boolean;
    smsPackageName?: string;
    /** Read payments out of apps with no parser of their own. */
    allowAnyApp?: boolean;
  } = {},
): ParsedPayment | null {
  if (options.smsPackageName && event.packageName === options.smsPackageName) {
    return (
      bankSmsParser.parse(event) ??
      (options.allowAnyApp ? parseGenericIncomingPayment(event) : null)
    );
  }

  const parser = PARSERS.find((p) =>
    p.packageNames.includes(event.packageName),
  );

  if (parser) {
    const result = parser.parse(event);
    if (result) {
      return result && parser === googlePayParser && options.treatGooglePayAsPersonal
        ? { ...result, source: "google_pay_personal" }
        : result;
    }
  }

  // Google Pay for Business, PhonePe Business and the rest each ship under
  // their own package name, and those change. Judging by the wording covers
  // every app, including ones that don't exist yet.
  return options.allowAnyApp ? parseGenericIncomingPayment(event) : null;
}

export function getRegisteredParsers(): readonly NotificationParser[] {
  return PARSERS;
}
