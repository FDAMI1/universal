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

void factoryReset() {
  prefs.remove("ssid");
  prefs.remove("pass");
  prefs.remove("token");
  config.wifiSsid = "";
  config.wifiPassword = "";
  config.authToken = "";
}
