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
)
