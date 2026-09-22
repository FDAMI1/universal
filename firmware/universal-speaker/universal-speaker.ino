// Universal Speaker: ESP32 sound box firmware.
// Receives payments from the Universal Speaker Android app over Wi-Fi and
// announces them in Hindi through the internal DAC (GPIO25) -> PAM8403 -> speaker.
//
// Board settings (Arduino IDE): see firmware/README.md.
//
// BOOT button:  short press  -> reads out IP address + PIN, allows pairing a new phone for 3 min
//               hold 8 s     -> factory reset (forgets Wi-Fi and paired phone)
// Blue LED:     fast blink = setup mode, slow blink = waiting for phone, solid = phone connected

#include <WiFi.h>
#include "AudioPlayer.h"
#include "DeviceConfig.h"
#include "HindiSpeech.h"
#include "SetupPortal.h"
#include "SpeakerServer.h"

// Lower this if the speaker sounds distorted and your amplifier has no volume knob.
constexpr uint8_t AUDIO_GAIN_PERCENT = 80;

constexpr int BOOT_BUTTON_PIN = 0;
constexpr int LED_PIN = 2;
constexpr uint32_t WIFI_BOOT_TIMEOUT_MS = 30 * 1000;
constexpr uint32_t FACTORY_RESET_HOLD_MS = 8 * 1000;
constexpr uint32_t SHORT_PRESS_MAX_MS = 2 * 1000;

bool setupMode = false;

void announceIpAndPin() {
  ClipId clips[AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT];
  const String ip = WiFi.localIP().toString();
  AudioPlayer::enqueue(clips, buildIpAndPinAnnouncement(ip.c_str(), config.pin.c_str(), clips, AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT));
  Serial.printf("[info] Device ID %s  IP %s  PIN %s  (enter these in the app)\n", config.deviceId.c_str(), ip.c_str(),
                config.pin.c_str());
}

void startSetupMode() {
  setupMode = true;
  SetupPortal::begin();
}

void handleBootButton() {
  static uint32_t pressedAt = 0;
  const bool down = digitalRead(BOOT_BUTTON_PIN) == LOW;
  const uint32_t now = millis();

  if (down) {
    if (pressedAt == 0) pressedAt = now;
    if (now - pressedAt > FACTORY_RESET_HOLD_MS) {
      Serial.println("[reset] factory reset");
      factoryReset();
      AudioPlayer::enqueue(CLIP_RESET);
      while (AudioPlayer::isBusy()) delay(50);
      ESP.restart();
    }
    return;
  }

  if (pressedAt != 0) {
    const uint32_t held = now - pressedAt;
    pressedAt = 0;
    if (held > 50 && held < SHORT_PRESS_MAX_MS && !setupMode) {
      SpeakerServer::openPairingWindow();
      announceIpAndPin();
    }
  }
}

void updateLed() {
  const uint32_t now = millis();
  bool on;
  if (setupMode) on = (now / 150) % 2;
  else if (SpeakerServer::hasPhoneConnected()) on = true;
  else on = (now / 1000) % 2;
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

  loadConfig();
  if (!AudioPlayer::begin(AUDIO_GAIN_PERCENT)) Serial.println("[audio] DAC init failed");
  Serial.printf("\nUniversal Speaker  Device ID %s  PIN %s\n", config.deviceId.c_str(), config.pin.c_str());

  if (!config.hasWifi()) {
    startSetupMode();
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // modem sleep adds 100ms+ latency to every incoming message
  WiFi.setAutoReconnect(true);
  WiFi.begin(config.wifiSsid.c_str(), config.wifiPassword.c_str());
  Serial.printf("[wifi] connecting to \"%s\"", config.wifiSsid.c_str());

  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_BOOT_TIMEOUT_MS) {
    digitalWrite(LED_PIN, (millis() / 250) % 2);
    delay(50);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" failed, starting setup mode");
    AudioPlayer::enqueue(CLIP_WIFI_FAIL);
    startSetupMode();
    return;
  }
  Serial.printf(" ok, IP %s\n", WiFi.localIP().toString().c_str());

  SpeakerServer::begin();
  AudioPlayer::enqueue(CLIP_WIFI_OK);
  if (!config.isPaired()) announceIpAndPin();
}

void loop() {
  if (setupMode) SetupPortal::loop();
  else SpeakerServer::loop();
  handleBootButton();
  updateLed();
  delay(5);
}
