package expo.modules.paymentnotificationlistener

/**
 * Decouples [PaymentBridgeService] (a plain Android Service, may run before
 * any JS/module instance exists) from [PaymentNotificationListenerModule]
 * (only exists while the Expo module is installed in a running app). The
 * module registers a listener on init; the service just calls [emit] and
 * doesn't care whether anything is currently listening.
 */
object PaymentBridgeEmitter {
  private var listener: ((RawNotificationEvent) -> Unit)? = null

  fun setListener(listener: ((RawNotificationEvent) -> Unit)?) {
    this.listener = listener
  }

  fun emit(event: RawNotificationEvent) {
    listener?.invoke(event)
  }
}
