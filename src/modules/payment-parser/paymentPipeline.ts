import { RawNotificationEvent } from "@native/payment-notification-listener";
import { PaymentObject } from "@shared/types/payment";
import { parseNotification } from "./parserRegistry";
import { validatePayment } from "./paymentValidator";
import { DuplicateDetector } from "./duplicateDetector";

export interface PaymentPipelineOptions {
  deviceId: string;
  minimumAmountPaise: number;
  duplicateTimeoutSeconds: number;
  treatGooglePayAsPersonal?: boolean;
  smsPackageName?: string;
  enabledSourcePackages: Set<string>;
}

export interface PipelineResult {
  payment: PaymentObject | null;
  rejectedReason?: string;
}

/**
 * The full notification -> payment-object pipeline (PDR modules 1-4):
 * source filter -> parse -> validate -> duplicate check. Returns a payment
 * only when every stage passes; otherwise a reason for observability in the
 * Logs screen.
 */
export function runPaymentPipeline(
  event: RawNotificationEvent,
  options: PaymentPipelineOptions,
  duplicateDetector: DuplicateDetector,
  nowMillis: number,
): PipelineResult {
  if (!options.enabledSourcePackages.has(event.packageName)) {
    return { payment: null, rejectedReason: "source not enabled" };
  }

  const parsed = parseNotification(event, {
    treatGooglePayAsPersonal: options.treatGooglePayAsPersonal,
    smsPackageName: options.smsPackageName,
  });
  if (!parsed) {
    return {
      payment: null,
      rejectedReason: "no parser matched notification content",
    };
  }

  const validation = validatePayment(parsed, event);
  if (!validation.valid) {
    return { payment: null, rejectedReason: validation.reason };
  }

  if (parsed.amount < options.minimumAmountPaise) {
    return { payment: null, rejectedReason: "below minimum amount threshold" };
  }

  duplicateDetector.setWindowMs(options.duplicateTimeoutSeconds * 1000);
  if (duplicateDetector.isDuplicate(parsed, nowMillis)) {
    return { payment: null, rejectedReason: "duplicate payment" };
  }

  const payment: PaymentObject = {
    ...parsed,
    deviceId: options.deviceId,
    timestamp: new Date(event.postTimeMillis || nowMillis).toISOString(),
  };

  return { payment };
}
