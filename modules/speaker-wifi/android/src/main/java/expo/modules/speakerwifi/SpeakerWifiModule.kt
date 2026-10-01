package expo.modules.speakerwifi

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.PatternMatcher
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Joins the speaker's own "Speaker-Setup-XXXXXX" access point from inside the
 * app, so the user never has to open Wi-Fi settings.
 *
 * Android 10+ only allows this through WifiNetworkSpecifier: the system shows
 * its own picker listing matching networks and the user taps one. That one tap
 * cannot be skipped — apps have not been allowed to silently join networks
 * since Android 10. Using an SSID *prefix* pattern means the picker doubles as
 * the "nearby speakers" list, which is why this module needs no location
 * permission and no Wi-Fi scanning.
 *
 * While joined, the process is bound to that network so HTTP requests reach
 * 192.168.4.1 instead of leaking out over mobile data.
 */
class SpeakerWifiModule : Module() {
  private val connectivityManager: ConnectivityManager?
    get() = appContext.reactContext
      ?.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager

  private var callback: ConnectivityManager.NetworkCallback? = null

  override fun definition() = ModuleDefinition {
    Name("SpeakerWifi")

    Events("onSpeakerNetworkLost")

    // False on Android 9 and older, where the app must fall back to sending
    // the user to Wi-Fi settings.
    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    }

    // Shows the system picker of nearby "Speaker-Setup-…" networks, joins the
    // one the user taps, and binds this app's traffic to it. Resolves with the
    // SSID that was joined.
    AsyncFunction("connectToSpeaker") { ssidPrefix: String, timeoutMs: Int, promise: expo.modules.kotlin.Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw UnsupportedAndroidVersionException()
      }
      val manager = connectivityManager ?: throw NoConnectivityServiceException()
      releaseNetwork()

      val specifier = WifiNetworkSpecifier.Builder()
        .setSsidPattern(PatternMatcher(ssidPrefix, PatternMatcher.PATTERN_PREFIX))
        .build()
      val request = NetworkRequest.Builder()
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        // The speaker's network has no internet, so this capability must be
        // removed or Android refuses to keep the request bound.
        .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .setNetworkSpecifier(specifier)
        .build()

      var settled = false
      val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: android.net.Network) {
          manager.bindProcessToNetwork(network)
          if (!settled) {
            settled = true
            promise.resolve(currentSsid())
          }
        }

        override fun onUnavailable() {
          if (!settled) {
            settled = true
            promise.reject(SpeakerNotJoinedException())
          }
          releaseNetwork()
        }

        override fun onLost(network: android.net.Network) {
          sendEvent("onSpeakerNetworkLost", mapOf<String, Any>())
          releaseNetwork()
        }
      }

      callback = networkCallback
      manager.requestNetwork(request, networkCallback, timeoutMs)
    }

    // Unbinds and drops the speaker network so the phone returns to its normal
    // Wi-Fi. Safe to call when nothing is connected.
    Function("disconnect") {
      releaseNetwork()
    }

    // The SSID currently bound, or null. Lets the UI confirm which speaker is
    // being configured.
    Function("currentSsid") {
      currentSsid()
    }

    OnDestroy {
      releaseNetwork()
    }
  }

  private fun currentSsid(): String? {
    val wifi = appContext.reactContext
      ?.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return null
    @Suppress("DEPRECATION")
    val ssid = wifi.connectionInfo.ssid ?: return null
    val cleaned = ssid.trim('"')
    return if (cleaned.isEmpty() || cleaned == "<unknown ssid>") null else cleaned
  }

  private fun releaseNetwork() {
    val manager = connectivityManager ?: return
    manager.bindProcessToNetwork(null)
    callback?.let {
      runCatching { manager.unregisterNetworkCallback(it) }
    }
    callback = null
  }
}

class UnsupportedAndroidVersionException :
  CodedException("Joining a speaker from inside the app needs Android 10 or newer.")

class NoConnectivityServiceException :
  CodedException("Wi-Fi is unavailable on this device right now.")

class SpeakerNotJoinedException :
  CodedException(
    "Couldn't join the speaker's Wi-Fi. Make sure the speaker is powered on " +
      "and in setup mode, then try again.",
  )
