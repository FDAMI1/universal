import { useCallback, useEffect, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { PaymentNotificationListener } from "@native/payment-notification-listener";

/**
 * Everything the app needs before a payment can be announced, as one list with
 * one "do the next thing" action.
 *
 * Android grants none of these from a single prompt: notification access and
 * the OEM autostart screens are settings pages the user has to visit, and only
 * one system screen can be open at a time. So the button hands the user the
 * next missing one, and the list re-checks itself whenever they come back.
 */
export type PermissionKey =
  | "postNotifications"
  | "notificationAccess"
  | "batteryOptimization"
  | "autoStart";

export interface PermissionItem {
  key: PermissionKey;
  title: string;
  why: string;
  /** The exact taps, in order, for people who'd rather follow a list. */
  steps: string[];
  granted: boolean;
  /** Android can't report OEM autostart state, so it's never shown as granted. */
  verifiable: boolean;
  required: boolean;
}

const ANDROID_13 = 33;

async function readPostNotifications(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (typeof Platform.Version === "number" && Platform.Version < ANDROID_13) {
    return true; // granted at install time before Android 13
  }
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

export function useAppPermissions() {
  const [items, setItems] = useState<PermissionItem[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS !== "android") {
      setItems([]);
      return;
    }
    const hasAutoStart = PaymentNotificationListener.hasAutoStartSettings();
    const next: PermissionItem[] = [
      {
        key: "postNotifications",
        title: "Show notifications",
        why: "Lets the app show that it's watching for payments, which is what keeps it running in the background.",
        steps: [
          "Tap the button above.",
          'Android asks "Allow Universal Speaker to send you notifications?"',
          "Tap Allow.",
        ],
        granted: await readPostNotifications(),
        verifiable: true,
        required: true,
      },
      {
        key: "notificationAccess",
        title: "Read payment notifications",
        why: "This is how payments are detected. The app reads notifications from PhonePe, Paytm and Google Pay only.",
        steps: [
          "Tap the button above. The phone's Notification access list opens.",
          "Scroll to Universal Speaker and tap it (or its switch).",
          "Turn the switch ON.",
          'A warning appears about reading all notifications. Tap Allow.',
          "Press Back to return here. The tick turns green.",
        ],
        granted: PaymentNotificationListener.isNotificationAccessGranted(),
        verifiable: true,
        required: true,
      },
      {
        key: "batteryOptimization",
        title: "Run without being slept",
        why: "Android pauses apps it thinks are unused. Without this, announcements stop while the phone is idle.",
        steps: [
          "Tap the button above.",
          'If a dialog appears, tap Allow. Done.',
          "If a list of apps opens instead: tap the menu at the top and choose All apps, find Universal Speaker, and set it to No restrictions (Xiaomi and Oppo), Unrestricted (stock Android) or Don't optimise.",
          "Press Back to return here.",
        ],
        granted: PaymentNotificationListener.isBatteryOptimizationIgnored(),
        verifiable: true,
        required: true,
      },
    ];

    if (hasAutoStart) {
      next.push({
        key: "autoStart",
        title: "Autostart",
        why: "Your phone's brand closes background apps on its own. Autostart keeps the app alive after a restart.",
        steps: [
          "Tap the button above. Your phone's Autostart list opens.",
          "Find Universal Speaker in the list.",
          "Turn its switch ON (it may already be on).",
          "Press Back to return here.",
          "This row stays orange whatever you do — Android gives apps no way to read this setting back. If the switch is on, you are done.",
        ],
        granted: false,
        verifiable: false,
        required: false,
      });
    }
    setItems(next);
  }, []);

  useEffect(() => {
    void refresh();
    // These are granted on system screens, so re-check on every return.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        PaymentNotificationListener.requestListenerRebind();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  /** Opens the next thing the user still has to grant. */
  const requestNext = useCallback(async () => {
    const pending = items.find((item) => !item.granted);
    if (!pending) return;
    setIsWorking(true);
    try {
      switch (pending.key) {
        case "postNotifications":
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          break;
        case "notificationAccess":
          PaymentNotificationListener.openNotificationAccessSettings();
          break;
        case "batteryOptimization":
          PaymentNotificationListener.requestIgnoreBatteryOptimizations();
          break;
        case "autoStart":
          PaymentNotificationListener.openAutoStartSettings();
          break;
      }
    } finally {
      setIsWorking(false);
      void refresh();
    }
  }, [items, refresh]);

  const requestOne = useCallback(
    async (key: PermissionKey) => {
      const item = items.find((candidate) => candidate.key === key);
      if (!item) return;
      switch (key) {
        case "postNotifications":
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          break;
        case "notificationAccess":
          PaymentNotificationListener.openNotificationAccessSettings();
          break;
        case "batteryOptimization":
          PaymentNotificationListener.requestIgnoreBatteryOptimizations();
          break;
        case "autoStart":
          PaymentNotificationListener.openAutoStartSettings();
          break;
      }
      void refresh();
    },
    [items, refresh],
  );

  const required = items.filter((item) => item.required);
  const grantedCount = required.filter((item) => item.granted).length;
  const nextPending = items.find((item) => !item.granted) ?? null;

  return {
    items,
    isWorking,
    refresh,
    requestNext,
    requestOne,
    grantedCount,
    requiredCount: required.length,
    allRequiredGranted: grantedCount === required.length && required.length > 0,
    nextPending,
  };
}
