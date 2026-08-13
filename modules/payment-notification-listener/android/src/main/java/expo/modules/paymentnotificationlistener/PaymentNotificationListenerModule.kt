package expo.modules.paymentnotificationlistener

import android.content.Context
import android.content.Intent
import android.provider.Settings
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
  }
}
