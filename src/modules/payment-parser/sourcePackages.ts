import { ToggleableSource } from "@shared/store/useSettingsStore";

/**
 * Which Android packages count as a payment source. Shared by the JS pipeline
 * and by the native listener's own filter — the native service drops anything
 * not in this set before JS ever sees it, so the two must agree or payments
 * vanish silently.
 */
export const SOURCE_PACKAGES: Record<ToggleableSource, string[]> = {
  phonepe_business: [
    "com.phonepe.app",
    "com.phonepe.merchant.android",
    "com.phonepe.business",
  ],
  paytm_business: [
    "net.one97.paytm",
    "com.paytm.business",
    "net.one97.paytm.merchant",
  ],
  google_pay: [
    "com.google.android.apps.nbu.paisa.user",
    // Google Pay for Business ships separately from the personal app.
    "com.google.android.apps.nbu.paisa.merchant",
  ],
};

/** Messaging apps that show bank SMS, used when the OS won't name a default. */
export const FALLBACK_SMS_PACKAGES = [
  "com.google.android.apps.messaging",
  "com.samsung.android.messaging",
  "com.miui.smsextra",
  "com.android.mms",
  "com.android.messaging",
];

export interface SourceSelection {
  enabledSources: Record<ToggleableSource, boolean>;
  smsEnabled: boolean;
  smsPackageName: string;
}

export function enabledSourcePackages(selection: SourceSelection): Set<string> {
  const packages = new Set<string>();
  for (const [source, names] of Object.entries(SOURCE_PACKAGES)) {
    if (selection.enabledSources[source as ToggleableSource]) {
      names.forEach((name) => packages.add(name));
    }
  }
  if (selection.smsEnabled) {
    if (selection.smsPackageName) {
      packages.add(selection.smsPackageName);
    } else {
      // Nothing detected yet: listen to the usual messaging apps rather than
      // dropping every bank alert on the floor.
      FALLBACK_SMS_PACKAGES.forEach((name) => packages.add(name));
    }
  }
  return packages;
}
