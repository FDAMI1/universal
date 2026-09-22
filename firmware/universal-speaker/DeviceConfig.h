#pragma once
#include <Arduino.h>

// Everything the speaker remembers across reboots, stored in NVS flash.
struct DeviceConfig {
  String wifiSsid;
  String wifiPassword;
  String deviceId;   // e.g. "SPK-3FA21C", derived from the MAC, never changes
  String deviceName;
  String pin;        // 6 digits, generated once, entered in the app to pair
  String authToken;  // shared secret sent by the paired phone; empty = unpaired

  bool hasWifi() const { return wifiSsid.length() > 0; }
  bool isPaired() const { return authToken.length() > 0; }
};

extern DeviceConfig config;

void loadConfig();
void saveWifi(const String& ssid, const String& password);
void savePairing(const String& authToken);
// Clears Wi-Fi and pairing. Device ID and PIN are kept (they're printed/known).
void factoryReset();
