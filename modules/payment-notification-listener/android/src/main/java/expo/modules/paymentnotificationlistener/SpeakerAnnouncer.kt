package expo.modules.paymentnotificationlistener

import android.content.Context
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.util.Locale

/**
 * Announces a payment without the app's JavaScript running.
 *
 * Android restarts this process for the notification listener alone, with no
 * React context — routinely, and every time the user clears recents on Xiaomi.
 * The listener kept capturing payments and the speaker stayed silent, because
 * everything that decides what to announce lived in JS.
 *
 * So this is a deliberately small second reader: amount, in or out, payer. It
 * runs only when JS is unavailable, posts straight to the speaker's HTTP
 * endpoint, and marks the event so the richer JS pipeline doesn't announce it
 * a second time when the app comes back. The JS version stays in charge
 * whenever the app is alive — it also keeps history, settings and the log.
 */
object SpeakerAnnouncer {
  private const val TAG = "PaymentListener"
  private const val PREFS = "speaker_target"
  private const val TIMEOUT_MS = 4000
  /** Matches the JS duplicate window: one payment is notified several times. */
  private const val REPEAT_WINDOW_MS = 30_000L

  /** Several payments can be in flight at once, so remembering only the last
   *  one let an interleaved repeat through. Matches what JS keeps. */
  private class Seen(val amount: Long, val payer: String?, val at: Long)

  private val seen = ArrayDeque<Seen>()

  private val OUTGOING = Regex(
    "\\b(debited|sent|paid to|you paid|spent|withdrawn|transfer(red)? to|requesting|has requested|pay now|due|failed|declined|cancell?ed)\\b",
    RegexOption.IGNORE_CASE,
  )
  private val INCOMING = Regex(
    "\\b(received|credited|credit of|you got|has paid you|paid you|payment received|deposited)\\b",
    RegexOption.IGNORE_CASE,
  )
  private val PROMOTIONAL = Regex(
    "\\b(cashback|reward|scratch card|offer|voucher|coupon|win|won|congratulations|discount|refer|bonus|points|loan|emi|insurance)\\b",
    RegexOption.IGNORE_CASE,
  )
  private val AMOUNT = Regex("(?:₹|Rs\\.?|INR)\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
  private val PAYER = Regex("\\bfrom\\s+([A-Za-z][A-Za-z.\\s]{1,40}?)(?=\\s+(?:on|via|to|ref|upi|at|a/c)|[.,!]|$)", RegexOption.IGNORE_CASE)

  /** Written by JS whenever pairing changes, so this can work without it. */
  fun saveTarget(context: Context, ip: String, deviceId: String, token: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("ip", ip).putString("deviceId", deviceId).putString("token", token)
      .apply()
  }

  fun clearTarget(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
  }

  /** True when the payment was announced here, so JS must not repeat it. */
  fun announce(context: Context, event: RawNotificationEvent): Boolean {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val ip = prefs.getString("ip", null) ?: return false
    val deviceId = prefs.getString("deviceId", null) ?: return false
    val token = prefs.getString("token", null) ?: return false

    val text = normalize(
      listOfNotNull(event.title, event.bigText ?: event.text, event.subText).joinToString(" "),
    )
    if (text.isEmpty()) return false
    if (OUTGOING.containsMatchIn(text)) return false
    if (PROMOTIONAL.containsMatchIn(text)) return false
    if (!INCOMING.containsMatchIn(text)) return false

    val paise = amountPaise(text) ?: return false
    val payer = PAYER.find(text)?.groupValues?.get(1)?.trim()?.uppercase(Locale.ROOT)
    if (isRepeat(paise, payer)) {
      Log.i(TAG, "native: repeat of a payment already announced")
      return true
    }

    return post(ip, deviceId, token, paise, payer)
  }

  /** Payment apps write amounts in styled digits (PhonePe uses U+1D7D9 and
   * friends); NFKC folds them back to ASCII. Mirrors the JS normaliser. */
  private fun normalize(raw: String): String =
    Normalizer.normalize(raw, Normalizer.Form.NFKC)
      .replace('\u00a0', ' ')
      .map { c ->
        when (c) {
          in '\u0966'..'\u096f' -> ('0' + (c - '\u0966'))
          in '\u0660'..'\u0669' -> ('0' + (c - '\u0660'))
          else -> c
        }
      }
      .joinToString("")

  private fun amountPaise(text: String): Long? {
    val digits = AMOUNT.find(text)?.groupValues?.get(1)?.replace(",", "") ?: return null
    val rupees = digits.toDoubleOrNull() ?: return null
    if (rupees <= 0) return null
    return Math.round(rupees * 100)
  }

  @Synchronized
  private fun isRepeat(paise: Long, payer: String?): Boolean {
    val now = System.currentTimeMillis()
    while (seen.isNotEmpty() && now - seen.first().at > REPEAT_WINDOW_MS) {
      seen.removeFirst()
    }
    // Same rule as JS: the payer decides when both sides name one, because two
    // customers paying the same amount are two sales, not one repeated.
    val repeat = seen.any { past ->
      past.amount == paise &&
        (payer == null || past.payer == null || samePayer(payer, past.payer))
    }
    seen.addLast(Seen(paise, payer, now))
    return repeat
  }

  /** One app truncates what another spells out. */
  private fun samePayer(a: String, b: String): Boolean =
    a == b || a.startsWith(b) || b.startsWith(a)

  private fun post(
    ip: String,
    deviceId: String,
    token: String,
    paise: Long,
    payer: String?,
  ): Boolean {
    val body = buildString {
      append("{\"v\":1,\"message\":{\"type\":\"payment\",\"deviceId\":\"").append(deviceId)
      append("\",\"authToken\":\"").append(token)
      append("\",\"payment\":{\"deviceId\":\"").append(deviceId)
      append("\",\"amount\":").append(paise)
      append(",\"currency\":\"INR\",\"payer\":")
      if (payer == null) append("null") else append("\"").append(payer.replace("\"", "")).append("\"")
      append(",\"source\":\"other_app\",\"paymentType\":\"incoming\",\"timestamp\":\"")
      append(java.time.Instant.now().toString())
      append("\",\"transactionId\":null,\"status\":\"success\"}}}")
    }

    return try {
      val connection = (URL("http://$ip:8080/message").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = TIMEOUT_MS
        readTimeout = TIMEOUT_MS
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }
      connection.outputStream.use { it.write(body.toByteArray()) }
      val code = connection.responseCode
      connection.disconnect()
      Log.i(TAG, "native announce of $paise paise -> HTTP $code")
      code in 200..299
    } catch (e: Exception) {
      Log.w(TAG, "native announce failed: ${e.message}")
      false
    }
  }
}
