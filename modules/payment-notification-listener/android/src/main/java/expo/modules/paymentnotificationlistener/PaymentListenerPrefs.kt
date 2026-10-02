package expo.modules.paymentnotificationlistener

import android.content.Context

/**
 * Persisted settings read by [PaymentListenerService], which can run in a
 * process with no JS/React context (killed app, notification arrives) — so
 * settings must live in SharedPreferences, not in-memory JS state.
 */
object PaymentListenerPrefs {
  private const val PREFS_NAME = "payment_notification_listener_prefs"
  private const val KEY_ENABLED_PACKAGES = "enabled_packages"
  private const val KEY_CAPTURE_ALL = "capture_all"

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** Replaces the full set of source app package names the listener should
   *  forward notifications from. Called from JS whenever the user toggles a
   *  source on/off in Settings. */
  fun setEnabledSourcePackages(context: Context, packages: Set<String>) {
    prefs(context).edit()
      .putStringSet(KEY_ENABLED_PACKAGES, packages)
      .apply()
  }

  fun getEnabledSourcePackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_ENABLED_PACKAGES, DEFAULT_PACKAGES) ?: DEFAULT_PACKAGES

  fun isSourcePackageEnabled(context: Context, packageName: String): Boolean =
    getEnabledSourcePackages(context).contains(packageName)

  /** Troubleshooting: forward notifications from every app, so the user can
   *  see what their bank or payment app actually posts and which package it
   *  comes from. Off by default; the app turns it off again on its own. */
  fun setCaptureAll(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_CAPTURE_ALL, enabled).apply()
  }

  fun isCaptureAll(context: Context): Boolean =
    prefs(context).getBoolean(KEY_CAPTURE_ALL, false)

  // BEST-EFFORT DEFAULTS, UNVERIFIED — placeholders until confirmed on real
  // devices (Settings > Apps > [app] > Advanced > "App details" shows the
  // real package name; `adb shell pm list packages | grep -i phonepe` etc.
  // also works). Overridable from JS Settings either way, so a wrong default
  // here never blocks the user — they just re-enable the correct package.
  private val DEFAULT_PACKAGES = setOf(
    "com.phonepe.app",
    "com.phonepe.merchant.android",
    "net.one97.paytm",
    "com.paytm.business",
    "com.google.android.apps.nbu.paisa.user",
  )
}
