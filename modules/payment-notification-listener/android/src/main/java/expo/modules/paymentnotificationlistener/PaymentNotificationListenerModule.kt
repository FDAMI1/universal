package expo.modules.paymentnotificationlistener

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaymentNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaymentNotificationListener")

    Events("onPaymentNotification")

    OnCreate {
      PaymentBridgeEmitter.setListener { event ->
        sendEvent(
          "onPaymentNotification",
          mapOf(
            "packageName" to event.packageName,
            "postTimeMillis" to event.postTimeMillis,
            "title" to event.title,
            "text" to event.text,
            "bigText" to event.bigText,
            "subText" to event.subText,
          ),
        )
      }
    }

    OnDestroy {
      PaymentBridgeEmitter.setListener(null)
    }

    // True once the user has granted "Notification access" in system
    // settings for this app. This is a static permission grant, not a
    // runtime prompt — Android only exposes it via ACTION_NOTIFICATION_LISTENER_SETTINGS.
    Function("isNotificationAccessGranted") {
      val ctx = appContext.reactContext ?: return@Function false
      val enabledListeners = Settings.Secure.getString(
        ctx.contentResolver,
        "enabled_notification_listeners",
      ) ?: ""
      enabledListeners.contains(ctx.packageName)
    }

    // True once onListenerConnected() has actually fired for this process —
    // distinct from isNotificationAccessGranted(), which only reflects the
    // system setting, not whether the service is currently bound.
    Function("isListenerConnected") {
      PaymentListenerBus.isListenerConnected()
    }

    // Opens the system "Notification access" list, where the user finds this
    // app and toggles it on. There is no way to grant this permission
    // programmatically.
    Function("openNotificationAccessSettings") {
      val ctx = appContext.reactContext
      if (ctx != null) {
        ctx.startActivity(
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    // Persists which source app packages should be forwarded, read by
    // PaymentListenerService even when this JS process isn't running.
    Function("setEnabledSourcePackages") { packages: List<String> ->
      val ctx = appContext.reactContext
      if (ctx != null) {
        PaymentListenerPrefs.setEnabledSourcePackages(ctx, packages.toSet())
      }
    }

    Function("getEnabledSourcePackages") {
      val ctx = appContext.reactContext ?: return@Function emptyList<String>()
      PaymentListenerPrefs.getEnabledSourcePackages(ctx).toList()
    }

    // Explicitly (re)starts the foreground bridge service, e.g. right after
    // the user grants notification access, so it doesn't wait for the first
    // matching notification.
    Function("startBridgeService") {
      val ctx = appContext.reactContext
      if (ctx != null) {
        val intent = Intent(ctx, PaymentBridgeService::class.java)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
      }
    }

    Function("stopBridgeService") {
      val ctx = appContext.reactContext
      if (ctx != null) {
        PaymentBridgeService.stop(ctx)
      }
    }

    // Asks the OS to re-bind the listener service without the user manually
    // toggling notification access off and on. Available on API 24+.
    Function("requestListenerRebind") {
      val ctx = appContext.reactContext
      if (ctx != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
        try {
          NotificationListenerService.requestRebind(
            android.content.ComponentName(ctx, PaymentListenerService::class.java),
          )
        } catch (e: Exception) {
          // Best-effort — the user can still fix this via system settings.
        }
      }
    }

    // Bank credit alerts arrive as SMS, shown by whichever messaging app the
    // phone uses. Asking the user to type that package name is a trap, so read
    // it from the OS.
    Function("getDefaultSmsPackage") {
      val ctx = appContext.reactContext ?: return@Function null
      Telephony.Sms.getDefaultSmsPackage(ctx)
    }

    Function("setCaptureAllNotifications") { enabled: Boolean ->
      val ctx = appContext.reactContext
      if (ctx != null) {
        PaymentListenerPrefs.setCaptureAll(ctx, enabled)
      }
    }

    Function("isCaptureAllNotifications") {
      val ctx = appContext.reactContext ?: return@Function false
      PaymentListenerPrefs.isCaptureAll(ctx)
    }

    // Android puts unused apps to sleep, which stops payment announcements
    // arriving while the phone sits idle on a counter. Exempting the app is
    // the only reliable fix.
    Function("isBatteryOptimizationIgnored") {
      val ctx = appContext.reactContext ?: return@Function false
      val power = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager
      power?.isIgnoringBatteryOptimizations(ctx.packageName) ?: false
    }

    Function("requestIgnoreBatteryOptimizations") {
      val ctx = appContext.reactContext ?: return@Function false
      // The direct request dialog needs the matching permission; when it is
      // missing or the OEM blocks it, fall through to the settings list.
      val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${ctx.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      if (startIfResolvable(ctx, direct)) return@Function true
      startIfResolvable(
        ctx,
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    // Xiaomi, Oppo, Vivo and others kill background apps unless the user turns
    // on "Autostart" in a screen Android itself knows nothing about. There is
    // no API to read the setting, so the app can only offer to open it.
    Function("hasAutoStartSettings") {
      val ctx = appContext.reactContext ?: return@Function false
      autoStartIntents().any { it.resolveActivity(ctx.packageManager) != null }
    }

    Function("openAutoStartSettings") {
      val ctx = appContext.reactContext ?: return@Function false
      for (intent in autoStartIntents()) {
        if (startIfResolvable(ctx, intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))) {
          return@Function true
        }
      }
      // Nothing vendor-specific: the app's own settings page is the best we can do.
      startIfResolvable(
        ctx,
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${ctx.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        },
      )
    }
  }

  private fun startIfResolvable(context: Context, intent: Intent): Boolean {
    if (intent.resolveActivity(context.packageManager) == null) return false
    return try {
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  /** Autostart screens for the OEM skins that have one, most specific first. */
  private fun autoStartIntents(): List<Intent> = listOf(
    Intent().setComponent(
      ComponentName(
        "com.miui.securitycenter",
        "com.miui.permcenter.autostart.AutoStartManagementActivity",
      ),
    ),
    Intent().setComponent(
      ComponentName(
        "com.coloros.safecenter",
        "com.coloros.safecenter.permission.startup.StartupAppListActivity",
      ),
    ),
    Intent().setComponent(
      ComponentName(
        "com.coloros.safecenter",
        "com.coloros.safecenter.startupapp.StartupAppListActivity",
      ),
    ),
    Intent().setComponent(
      ComponentName(
        "com.vivo.permissionmanager",
        "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
      ),
    ),
    Intent().setComponent(
      ComponentName(
        "com.huawei.systemmanager",
        "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      ),
    ),
    Intent().setComponent(
      ComponentName(
        "com.samsung.android.lool",
        "com.samsung.android.sm.ui.battery.BatteryActivity",
      ),
    ),
  )
}
