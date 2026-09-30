#pragma once
#include <Arduino.h>

// Volume the speaker starts with before the app ever sets one. Lower it if
// the amplifier distorts and has no volume knob.
constexpr uint8_t DEFAULT_VOLUME_PERCENT = 80;

// Everything the speaker remembers across reboots, stored in NVS flash.
struct DeviceConfig {
  String wifiSsid;
  String wifiPassword;
  String deviceId;   // e.g. "SPK-3FA21C", derived from the MAC, never changes
  String deviceName;
  String pin;        // 6 digits, generated once, entered in the app to pair
  String authToken;  // shared secret sent by the paired phone; empty = unpaired
  uint8_t volume;    // 0-100, set from the app and kept across reboots

  bool hasWifi() const { return wifiSsid.length() > 0; }
  bool isPaired() const { return authToken.length() > 0; }
};

extern DeviceConfig config;

void loadConfig();
void saveWifi(const String& ssid, const String& password);
void savePairing(const String& authToken);
void saveVolume(uint8_t percent);
// Clears Wi-Fi and pairing. Device ID and PIN are kept (they're printed/known).
void factoryReset();
