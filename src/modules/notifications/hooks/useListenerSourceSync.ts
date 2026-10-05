import { useEffect } from "react";
import { Platform } from "react-native";
import { PaymentNotificationListener } from "@native/payment-notification-listener";
import { useSettingsStore } from "@shared/store/useSettingsStore";
import { enabledSourcePackages } from "@modules/payment-parser/sourcePackages";

/**
 * Keeps the native listener's package filter in step with Settings.
 *
 * The listener runs in a process with no JS — a notification can arrive with
 * the app swiped away — so it filters by a list in SharedPreferences. Nothing
 * ever wrote that list, which meant a source the user switched on (bank SMS
 * above all) was dropped natively and never reached the app at all.
 *
 * Mount once near the app root.
 */
export function useListenerSourceSync() {
  const enabledSources = useSettingsStore((state) => state.enabledSources);
  const anyAppEnabled = useSettingsStore((state) => state.anyAppEnabled);
  const smsEnabled = useSettingsStore((state) => state.smsEnabled);
  const smsPackageName = useSettingsStore((state) => state.smsPackageName);
  const setSmsPackageName = useSettingsStore((state) => state.setSmsPackageName);

  // Bank SMS is shown by whichever messaging app the phone uses; ask the OS
  // rather than making the user find the package name.
  useEffect(() => {
    if (Platform.OS !== "android" || smsPackageName) return;
    const detected = PaymentNotificationListener.getDefaultSmsPackage();
    if (detected) setSmsPackageName(detected);
  }, [smsPackageName, setSmsPackageName]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const packages = enabledSourcePackages({
      enabledSources,
      smsEnabled,
      smsPackageName,
    });
    PaymentNotificationListener.setEnabledSourcePackages([...packages]);
    // The native listener drops anything not in that list before JS runs, so
    // "any payment app" has to switch the filter off at that level too.
    PaymentNotificationListener.setCaptureAllNotifications(anyAppEnabled);
  }, [enabledSources, smsEnabled, smsPackageName, anyAppEnabled]);
}
