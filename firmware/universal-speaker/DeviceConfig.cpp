#include "DeviceConfig.h"
#include <Preferences.h>
#include <esp_mac.h>
#include <esp_random.h>

DeviceConfig config;

namespace {

Preferences prefs;
constexpr const char* NAMESPACE = "speaker";

String makeDeviceId() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char id[16];
  snprintf(id, sizeof(id), "SPK-%02X%02X%02X", mac[3], mac[4], mac[5]);
  return id;
}

/** 128 bits of randomness as hex: unguessable, and safe in a topic name. */
String makeRelayKey() {
  char key[33];
  for (int i = 0; i < 32; i += 8) {
    snprintf(key + i, 9, "%08lx", static_cast<unsigned long>(esp_random()));
  }
  return key;
}

String makePin() {
  char pin[8];
  snprintf(pin, sizeof(pin), "%06lu", static_cast<unsigned long>(esp_random() % 1000000));
  return pin;
}

}  // namespace

void loadConfig() {
  prefs.begin(NAMESPACE, false);
  config.wifiSsid = prefs.getString("ssid", "");
  config.wifiPassword = prefs.getString("pass", "");
  config.authToken = prefs.getString("token", "");
  config.deviceName = prefs.getString("name", "Universal Speaker");
  config.volume = prefs.getUChar("vol", DEFAULT_VOLUME_PERCENT);
  config.relayUri = prefs.getString("relayUri", DEFAULT_RELAY_URI);
  config.relayWsUri = prefs.getString("relayWs", DEFAULT_RELAY_WS_URI);
  config.relayUser = prefs.getString("relayUser", "");
  config.relayPassword = prefs.getString("relayPass", "");

  // The topic nobody can guess. Generated once, handed to the phone when it
  // pairs, and kept until a factory reset.
  config.relayKey = prefs.getString("relayKey", "");
  if (config.relayKey.length() != 32) {
    config.relayKey = makeRelayKey();
    prefs.putString("relayKey", config.relayKey);
  }
  config.deviceId = makeDeviceId();

  config.pin = prefs.getString("pin", "");
  if (config.pin.length() != 6) {
    config.pin = makePin();
    prefs.putString("pin", config.pin);
  }
}

void saveWifi(const String& ssid, const String& password) {
  config.wifiSsid = ssid;
  config.wifiPassword = password;
  prefs.putString("ssid", ssid);
  prefs.putString("pass", password);
}

void savePairing(const String& authToken) {
  config.authToken = authToken;
  prefs.putString("token", authToken);
}

void saveRelay(const String& uri, const String& wsUri, const String& user, const String& password) {
  config.relayUri = uri;
  config.relayWsUri = wsUri;
  prefs.putString("relayWs", wsUri);
  config.relayUser = user;
  config.relayPassword = password;
  prefs.putString("relayUri", uri);
  prefs.putString("relayUser", user);
  prefs.putString("relayPass", password);
}

void saveVolume(uint8_t percent) {
  config.volume = percent > 100 ? 100 : percent;
  prefs.putUChar("vol", config.volume);
}

void factoryReset() {
  prefs.remove("ssid");
  prefs.remove("pass");
  prefs.remove("token");
  prefs.remove("vol");
  prefs.remove("relayKey");
  config.wifiSsid = "";
  config.wifiPassword = "";
  config.authToken = "";
  config.volume = DEFAULT_VOLUME_PERCENT;
}
