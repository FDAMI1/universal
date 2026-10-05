package expo.modules.paymentnotificationlistener

import java.util.ArrayDeque

/**
 * Decouples [PaymentBridgeService] (a plain Android Service, may run before
 * any JS/module instance exists) from [PaymentNotificationListenerModule]
 * (only exists while the Expo module is installed in a running app). The
 * module registers a listener on init; the service just calls [emit] and
 * doesn't care whether anything is currently listening.
 *
 * Events that arrive with nothing listening are held rather than dropped.
 * Android kills the app's JS side whenever it feels like it — aggressively so
 * on Xiaomi — and a payment that landed in that window used to vanish with no
 * trace. They are replayed the moment JS comes back.
 */
object PaymentBridgeEmitter {
  /** A shop's busiest minute, not a day's history: anything older is stale. */
  private const val MAX_PENDING = 20

  private var listener: ((RawNotificationEvent) -> Unit)? = null
  private val pending = ArrayDeque<RawNotificationEvent>()

  @Synchronized
  fun setListener(listener: ((RawNotificationEvent) -> Unit)?) {
    this.listener = listener
    if (listener == null) return
    while (pending.isNotEmpty()) {
      listener(pending.removeFirst())
    }
  }

  @Synchronized
  fun emit(event: RawNotificationEvent) {
    val current = listener
    if (current != null) {
      current(event)
      return
    }
    if (pending.size >= MAX_PENDING) pending.removeFirst()
    pending.addLast(event)
  }
}
