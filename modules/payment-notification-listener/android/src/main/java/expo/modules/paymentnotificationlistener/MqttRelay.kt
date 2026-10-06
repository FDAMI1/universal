package expo.modules.paymentnotificationlistener

import android.util.Log
import java.io.DataInputStream
import java.io.OutputStream
import java.net.URI
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * Publishes one MQTT message over TLS, then hangs up.
 *
 * This is the path that matters when the shop's owner is out: the phone is
 * locked, so Android has frozen the app's JavaScript, and the native side is
 * the only part still running — but a locked phone on mobile data cannot
 * reach the speaker's local address at all. Without this, every payment taken
 * while the owner was away went unannounced.
 *
 * Written against the MQTT 3.1.1 packet format rather than pulling in a
 * client library: publishing is CONNECT, PUBLISH, DISCONNECT, and a library
 * would drag in a service, a work queue and a lifecycle this has no use for.
 */
object MqttRelay {
  private const val TAG = "PaymentListener"
  private const val CONNECT = 0x10
  private const val CONNACK = 0x20
  private const val PUBLISH = 0x30
  private const val PUBACK = 0x40
  private const val DISCONNECT = 0xe0
  private const val KEEPALIVE_SECONDS = 30
  private const val TIMEOUT_MS = 8000

  /** Remaining Length: seven bits a byte, top bit means "more follows". */
  private fun encodeLength(value: Int): ByteArray {
    val out = ArrayList<Byte>(4)
    var remaining = value
    do {
      var byte = remaining % 128
      remaining /= 128
      if (remaining > 0) byte = byte or 0x80
      out.add(byte.toByte())
    } while (remaining > 0)
    return out.toByteArray()
  }

  /** Every MQTT string is UTF-8 behind a two-byte length. */
  private fun encodeString(value: String): ByteArray {
    val bytes = value.toByteArray(Charsets.UTF_8)
    return byteArrayOf((bytes.size shr 8).toByte(), bytes.size.toByte()) + bytes
  }

  private fun packet(header: Int, body: ByteArray): ByteArray =
    byteArrayOf(header.toByte()) + encodeLength(body.size) + body

  private fun connectPacket(clientId: String, user: String?, password: String?): ByteArray {
    var flags = 0x02 // clean session
    if (!user.isNullOrEmpty()) flags = flags or 0x80
    if (!password.isNullOrEmpty()) flags = flags or 0x40

    var body = byteArrayOf(0, 4) + "MQTT".toByteArray() +
      byteArrayOf(0x04, flags.toByte(), (KEEPALIVE_SECONDS shr 8).toByte(), KEEPALIVE_SECONDS.toByte()) +
      encodeString(clientId)
    if (!user.isNullOrEmpty()) body += encodeString(user)
    if (!password.isNullOrEmpty()) body += encodeString(password)
    return packet(CONNECT, body)
  }

  private fun publishPacket(topic: String, payload: String): ByteArray {
    val body = encodeString(topic) + byteArrayOf(0, 1) + payload.toByteArray(Charsets.UTF_8)
    return packet(PUBLISH or 0x02, body) // QoS 1: the broker has to acknowledge
  }

  /** Reads one packet's fixed header and body, returning its type. */
  private fun readPacketType(input: DataInputStream): Int {
    val header = input.read()
    if (header < 0) throw IllegalStateException("the broker closed the connection")
    var multiplier = 1
    var length = 0
    while (true) {
      val digit = input.read()
      if (digit < 0) throw IllegalStateException("the broker closed the connection")
      length += (digit and 0x7f) * multiplier
      if (digit and 0x80 == 0) break
      multiplier *= 128
    }
    if (length > 0) input.readFully(ByteArray(length))
    return header and 0xf0
  }

  /**
   * Returns true once the broker has taken responsibility for the message.
   * `uri` is the speaker's broker as mqtts://host:port.
   */
  fun publish(
    uri: String,
    topic: String,
    payload: String,
    user: String?,
    password: String?,
    clientId: String,
  ): Boolean {
    var socket: SSLSocket? = null
    return try {
      val parsed = URI(uri)
      val host = parsed.host
      if (host == null) {
        Log.w(TAG, "relay: cannot parse broker address '$uri'")
        return false
      }
      val port = if (parsed.port > 0) parsed.port else 8883

      socket = (SSLSocketFactory.getDefault() as SSLSocketFactory)
        .createSocket(host, port) as SSLSocket
      socket.soTimeout = TIMEOUT_MS
      socket.startHandshake()

      val out: OutputStream = socket.outputStream
      val input = DataInputStream(socket.inputStream)

      out.write(connectPacket(clientId, user, password))
      out.flush()
      if (readPacketType(input) != CONNACK) {
        Log.w(TAG, "relay: the broker did not accept the connection")
        return false
      }

      out.write(publishPacket(topic, payload))
      out.flush()
      val acknowledged = readPacketType(input) == PUBACK

      out.write(byteArrayOf(DISCONNECT.toByte(), 0))
      out.flush()
      if (acknowledged) Log.i(TAG, "relay: published to $topic")
      acknowledged
    } catch (e: Exception) {
      Log.w(TAG, "relay publish failed: ${e.message}")
      false
    } finally {
      try {
        socket?.close()
      } catch (e: Exception) {
        // Already gone; the message was either taken or it was not.
      }
    }
  }
}
