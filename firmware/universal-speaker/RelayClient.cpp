#include "RelayClient.h"
#include <Arduino.h>
#include <WiFi.h>
#include "DeviceConfig.h"
#include "SpeakerServer.h"
#include "esp_crt_bundle.h"
#include "mqtt_client.h"

namespace RelayClient {
namespace {

// ESP-IDF's own MQTT client, which ships with the Arduino core — no extra
// library for anyone building this in the Arduino IDE.
esp_mqtt_client_handle_t client = nullptr;
volatile bool connected = false;
String topicIn;
String topicOut;

/** Topics are private per speaker: the relay key is a random secret the phone
 * learns only by pairing, so nobody can address this speaker without it. */
void buildTopics() {
  topicIn = "uspk/" + config.relayKey + "/in";
  topicOut = "uspk/" + config.relayKey + "/out";
}

void onEvent(void*, esp_event_base_t, int32_t id, void* data) {
  auto* event = static_cast<esp_mqtt_event_handle_t>(data);
  switch (static_cast<esp_mqtt_event_id_t>(id)) {
    case MQTT_EVENT_CONNECTED:
      connected = true;
      esp_mqtt_client_subscribe(client, topicIn.c_str(), 1);
      Serial.println("[relay] connected");
      break;

    case MQTT_EVENT_DISCONNECTED:
      connected = false;
      Serial.println("[relay] disconnected");
      break;

    case MQTT_EVENT_DATA: {
      // One payment per message and nothing is fragmented in practice, so a
      // partial frame means something is wrong rather than something to
      // reassemble.
      if (event->current_data_offset != 0 || event->data_len != event->total_data_len) {
        Serial.println("[relay] ignoring a fragmented message");
        break;
      }
      const String reply = SpeakerServer::handleRelayMessage(event->data, event->data_len);
      if (!reply.isEmpty()) {
        esp_mqtt_client_publish(client, topicOut.c_str(), reply.c_str(), reply.length(), 0, false);
      }
      break;
    }

    default:
      break;
  }
}

}  // namespace

void begin() {
  if (!config.relayEnabled() || client != nullptr) return;
  buildTopics();

  esp_mqtt_client_config_t cfg = {};
  cfg.broker.address.uri = config.relayUri.c_str();
  // The public brokers use ordinary web certificates, so the bundle the core
  // already carries is enough; no certificate to copy in by hand.
  cfg.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;
  if (config.relayUser.length() > 0) {
    cfg.credentials.username = config.relayUser.c_str();
    cfg.credentials.authentication.password = config.relayPassword.c_str();
  }
  cfg.credentials.client_id = config.deviceId.c_str();
  cfg.session.keepalive = 30;
  cfg.network.reconnect_timeout_ms = 5000;

  client = esp_mqtt_client_init(&cfg);
  if (client == nullptr) {
    Serial.println("[relay] could not start");
    return;
  }
  esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, onEvent, nullptr);
  if (esp_mqtt_client_start(client) != ESP_OK) {
    Serial.println("[relay] could not connect");
    return;
  }
  // Printed on the wire only, where reading it needs physical access: this
  // topic is what lets a phone reach the speaker from outside the shop.
  Serial.printf("[relay] using %s topic %s\n", config.relayUri.c_str(), topicIn.c_str());
}

void loop() {
  // esp-mqtt reconnects on its own; this only covers the relay being switched
  // on (or its broker changed) while the speaker is already running.
  if (config.relayEnabled() && client == nullptr && WiFi.status() == WL_CONNECTED) {
    begin();
  }
}

bool isConnected() { return connected; }

}  // namespace RelayClient
