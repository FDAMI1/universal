#pragma once
#include <Arduino.h>

// Volume the speaker starts with before the app ever sets one. Lower it if
// the amplifier distorts and has no volume knob.
constexpr uint8_t DEFAULT_VOLUME_PERCENT = 80;

// Public broker, over TLS. Only the amount and its source ever cross it, and
// the topic is a per-speaker secret. Point this at your own broker from the
// app's settings if you would rather not share one.
#define DEFAULT_RELAY_URI "mqtts://broker.emqx.io:8883"
#define DEFAULT_RELAY_WS_URI "wss://broker.emqx.io:8084/mqtt"

// Everything the speaker remembers across reboots, stored in NVS flash.
struct DeviceConfig {
  String wifiSsid;
  String wifiPassword;
  String deviceId;   // e.g. "SPK-3FA21C", derived from the MAC, never changes
  String deviceName;
  String pin;        // 6 digits, generated once, entered in the app to pair
  String authToken;  // shared secret sent by the paired phone; empty = unpaired
  uint8_t volume;    // 0-100, set from the app and kept across reboots

  // Relay: how the phone reaches this speaker from outside the shop's Wi-Fi.
  String relayUri;       // e.g. mqtts://broker.emqx.io:8883; empty = off
  String relayWsUri;     // the same broker over WebSocket, for the phone
  String relayUser;
  String relayPassword;
  String relayKey;       // random, secret: the phone's half of a private topic

  bool hasWifi() const { return wifiSsid.length() > 0; }
  bool isPaired() const { return authToken.length() > 0; }
  bool relayEnabled() const { return relayUri.length() > 0 && relayKey.length() > 0; }
};

extern DeviceConfig config;

void loadConfig();
void saveWifi(const String& ssid, const String& password);
void savePairing(const String& authToken);
void saveVolume(uint8_t percent);
void saveRelay(const String& uri, const String& wsUri, const String& user, const String& password);
// Clears Wi-Fi and pairing. Device ID and PIN are kept (they're printed/known).
void factoryReset();
