import { useEffect, useRef } from "react";
import { usePaymentNotificationListener } from "@modules/notifications/hooks/usePaymentNotificationListener";
import { useSettingsStore } from "@shared/store/useSettingsStore";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { useActivityLogStore } from "@shared/store/useActivityLogStore";
import { usePaymentHistoryStore } from "@shared/store/usePaymentHistoryStore";
import { runPaymentPipeline } from "./paymentPipeline";
import { DuplicateDetector } from "./duplicateDetector";
import { RawNotificationEvent } from "@native/payment-notification-listener";
import { generateId } from "@shared/utils/id";
import { getActiveEsp32Connection } from "@shared/net/useEsp32ConnectionManager";
import { enabledSourcePackages } from "./sourcePackages";

/**
 * Wires the native notification listener to the parse/validate/dedup
 * pipeline for the lifetime of the mounting component. Mount this once near
 * the app root so payments are captured regardless of which screen is
 * active.
 */
export function usePaymentPipelineRunner() {
  const { subscribeToPayments } = usePaymentNotificationListener();
  const detectorRef = useRef(new DuplicateDetector(30_000));

  useEffect(() => {
    const unsubscribe = subscribeToPayments((event: RawNotificationEvent) => {
      const {
        enabledSources,
        googlePayMode,
        anyAppEnabled,
        verboseLogging,
        smsEnabled,
        smsPackageName,
        minimumAmount,
        duplicateTimeoutSeconds,
      } = useSettingsStore.getState();
      const { pairedDevice } = useDeviceStore.getState();

      const sourcePackages = enabledSourcePackages({
        enabledSources,
        smsEnabled,
        smsPackageName,
      });

      const result = runPaymentPipeline(
        event,
        {
          deviceId: pairedDevice?.id ?? "unpaired",
          minimumAmountPaise: minimumAmount,
          duplicateTimeoutSeconds,
          enabledSourcePackages: sourcePackages,
          allowAnyApp: anyAppEnabled,
          treatGooglePayAsPersonal: googlePayMode === "personal",
          smsPackageName: smsEnabled ? smsPackageName : undefined,
        },
        detectorRef.current,
        Date.now(),
      );

      if (result.payment) {
        const payment = result.payment;
        usePaymentHistoryStore
          .getState()
          .addPayment(payment)
          .then((entry) => {
            useActivityLogStore.getState().addEntry({
              id: generateId(),
              type: "payment",
              at: new Date().toISOString(),
              payment,
            });

            // Already said aloud by the native fallback while the app was
            // not running: keep the record, don't announce it twice.
            if (event.announcedNatively) {
              usePaymentHistoryStore.getState().markAnnounced(entry.id);
              return;
            }

            const connection = getActiveEsp32Connection();
            if (!pairedDevice || !connection) return;
            connection
              .send({
                type: "payment",
                deviceId: pairedDevice.id,
                authToken: pairedDevice.authToken,
                payment,
              })
              .then(() =>
                usePaymentHistoryStore.getState().markAnnounced(entry.id),
              )
              .catch((error) => {
                useActivityLogStore.getState().addEntry({
                  id: generateId(),
                  type: "error",
                  at: new Date().toISOString(),
                  message: `failed to send payment to speaker: ${String(error)}`,
                });
              });
          })
          .catch((error) => {
            useActivityLogStore.getState().addEntry({
              id: generateId(),
              type: "error",
              at: new Date().toISOString(),
              message: `failed to persist payment: ${String(error)}`,
            });
          });
      } else if (verboseLogging) {
        useActivityLogStore.getState().addEntry({
          id: generateId(),
          type: "rejected",
          at: new Date().toISOString(),
          packageName: event.packageName,
          reason: result.rejectedReason ?? "unknown",
          // Kept so an unrecognised bank or app wording can be read off the
          // Logs screen instead of guessed at.
          text: [event.title, event.bigText ?? event.text]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 200),
        });
      }
    });

    return unsubscribe;
  }, [subscribeToPayments]);
}
