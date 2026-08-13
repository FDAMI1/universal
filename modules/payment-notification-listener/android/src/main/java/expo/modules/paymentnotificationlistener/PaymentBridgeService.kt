package expo.modules.paymentnotificationlistener

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps this process alive so payment notifications
 * keep getting captured and relayed while the app is backgrounded or the
 * user's screen is off. [PaymentListenerService] enqueues events into it via
 * [enqueue]; from here they're forwarded to JS (Phase 2) and, in a later
 * phase, over the network to the paired ESP32.
 *
 * The WAKE_LOCK + startForeground handling mirrors the reliability lessons
 * from this project's azan-player module: a foreground start can be blocked
 * by the OS under Doze/background restrictions, and that failure must be
 * caught rather than crash the process.
 */
class PaymentBridgeService : Service() {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val started = startAsForeground()
    if (!started) {
      Log.w(TAG, "foreground start blocked — stopping self")
      stopSelf()
      return
    }
    acquireWakeLock()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val event = intent?.let { pendingEvents.poll() }
    if (event != null) {
      PaymentBridgeEmitter.emit(event)
    }
    // If the OS kills this process, don't auto-restart with a stale intent —
    // the next real notification will start it again via enqueue().
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    super.onDestroy()
  }

  private fun startAsForeground(): Boolean {
    ensureChannel()
    val notification = buildNotification()
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(NOTIF_ID, notification)
      }
      true
    } catch (e: Exception) {
      Log.w(TAG, "startForeground failed: ${e.message}")
      false
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Payment listener",
        NotificationManager.IMPORTANCE_MIN,
      ).apply {
        description = "Keeps payment detection running in the background"
      }
      mgr.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Universal Speaker is listening")
      .setContentText("Watching for payment notifications")
      .setSmallIcon(android.R.drawable.stat_sys_download_done)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
    if (launch != null) {
      builder.setContentIntent(
        PendingIntent.getActivity(
          this,
          0,
          launch,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        ),
      )
    }
    return builder.build()
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "UniversalSpeaker:bridge").apply {
      setReferenceCounted(false)
      acquire(WAKE_LOCK_TIMEOUT_MS)
    }
  }

  private fun releaseWakeLock() {
    if (wakeLock?.isHeld == true) wakeLock?.release()
    wakeLock = null
  }

  companion object {
    private const val TAG = "PaymentBridge"
    private const val CHANNEL_ID = "payment-bridge"
    private const val NOTIF_ID = 5821
    // Safety cap, refreshed on every enqueue; not meant to be held continuously.
    private const val WAKE_LOCK_TIMEOUT_MS = 60_000L

    private val pendingEvents = java.util.concurrent.ConcurrentLinkedQueue<RawNotificationEvent>()

    /** Called from [PaymentListenerService] whenever a matching notification
     *  is posted. Starts (or reuses) the foreground service and hands the
     *  event to it for JS emission. */
    fun enqueue(context: Context, event: RawNotificationEvent) {
      pendingEvents.add(event)
      val intent = Intent(context, PaymentBridgeService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        Log.w(TAG, "failed to start bridge service: ${e.message}")
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, PaymentBridgeService::class.java))
    }
  }
}
