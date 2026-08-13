package expo.modules.paymentnotificationlistener

import android.app.Notification
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Reads every notification posted on the device and forwards the ones from
 * app packages the user has enabled (set via [PaymentListenerPrefs]) to
 * [PaymentBridgeService]. Parsing/validation happens in JS — this service only
 * extracts the raw fields, so adding support for a new payment app never
 * requires a native code change (see PDR "modular parser architecture").
 */
class PaymentListenerService : NotificationListenerService() {

  override fun onListenerConnected() {
    super.onListenerConnected()
    Log.i(TAG, "listener connected")
    PaymentListenerBus.setListenerConnected(true)
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    Log.i(TAG, "listener disconnected")
    PaymentListenerBus.setListenerConnected(false)
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val packageName = sbn.packageName ?: return

    // Never process our own notifications (foreground-service notice, etc.) —
    // avoids feedback loops and wasted work.
    if (packageName == applicationContext.packageName) return

    if (!PaymentListenerPrefs.isSourcePackageEnabled(applicationContext, packageName)) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()

    // Skip notifications with no readable content at all (e.g. summary/group
    // stubs some apps post alongside the real one).
    if (title.isNullOrBlank() && text.isNullOrBlank() && bigText.isNullOrBlank()) return

    val event = RawNotificationEvent(
      packageName = packageName,
      postTimeMillis = sbn.postTime,
      title = title,
      text = text,
      bigText = bigText,
      subText = subText,
    )

    Log.i(TAG, "captured notification from $packageName")

    // Hand off to the foreground bridge service so it keeps running (and can
    // forward to the ESP32 / emit to JS) even while this app is backgrounded.
    PaymentBridgeService.enqueue(applicationContext, event)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    // Not needed: we only care about notifications as they're posted.
  }

  companion object {
    private const val TAG = "PaymentListener"
  }
}
