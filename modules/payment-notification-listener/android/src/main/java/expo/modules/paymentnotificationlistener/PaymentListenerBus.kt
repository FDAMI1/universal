package expo.modules.paymentnotificationlistener

/** In-process (not persisted) state, valid only while this process is alive.
 *  Read by [PaymentNotificationListenerModule] so JS can reflect whether the
 *  notification-listener service is currently bound and running. */
object PaymentListenerBus {
  @Volatile
  private var listenerConnected = false

  fun setListenerConnected(connected: Boolean) {
    listenerConnected = connected
  }

  fun isListenerConnected(): Boolean = listenerConnected
}
