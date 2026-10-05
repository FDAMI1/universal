package expo.modules.paymentnotificationlistener

/** The unparsed fields lifted from a posted notification. Parsing into the
 *  spec's standard payment object happens in JS, per source. */
data class RawNotificationEvent(
  val packageName: String,
  val postTimeMillis: Long,
  val title: String?,
  val text: String?,
  val bigText: String?,
  val subText: String?,
  /** True when the native fallback already announced this, because JS was
   *  not running at the time. JS then records it without announcing again. */
  val announcedNatively: Boolean = false,
)
