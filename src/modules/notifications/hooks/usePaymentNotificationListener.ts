import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  PaymentNotificationListener,
  RawNotificationEvent,
} from "@native/payment-notification-listener";

interface ListenerStatus {
  accessGranted: boolean;
  listenerConnected: boolean;
}

function readStatus(): ListenerStatus {
  return {
    accessGranted: PaymentNotificationListener.isNotificationAccessGranted(),
    listenerConnected: PaymentNotificationListener.isListenerConnected(),
  };
}

export function usePaymentNotificationListener() {
  const [status, setStatus] = useState<ListenerStatus>(() => readStatus());

  const refreshStatus = useCallback(() => {
    setStatus(readStatus());
  }, []);

  useEffect(() => {
    // Access is granted outside the app (system settings), so re-check
    // whenever the user returns to the app rather than relying on a single
    // check at mount time.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshStatus();
        PaymentNotificationListener.requestListenerRebind();
      }
    });
    return () => subscription.remove();
  }, [refreshStatus]);

  const openSettings = useCallback(() => {
    PaymentNotificationListener.openNotificationAccessSettings();
  }, []);

  const subscribeToPayments = useCallback(
    (onEvent: (event: RawNotificationEvent) => void) => {
      const subscription = PaymentNotificationListener.addListener(
        "onPaymentNotification",
        onEvent,
      );
      return () => subscription.remove();
    },
    [],
  );

  return {
    ...status,
    refreshStatus,
    openSettings,
    subscribeToPayments,
  };
}
