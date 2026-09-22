#include "SpeakerServer.h"
#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <ESPAsyncWebServer.h>
#include "AudioPlayer.h"
#include "DeviceConfig.h"
#include "HindiSpeech.h"

namespace SpeakerServer {
namespace {

constexpr int PROTOCOL_VERSION = 1;
constexpr uint32_t PAIRING_WINDOW_MS = 3 * 60 * 1000;
constexpr uint8_t MAX_PIN_FAILURES = 5;
constexpr uint32_t PIN_LOCKOUT_MS = 60 * 1000;
constexpr uint8_t MAX_WS_CLIENTS = 3;

AsyncWebServer server(PORT);
AsyncWebSocket ws("/");

volatile uint32_t pairingWindowEndsAt = 0;
uint8_t pinFailures = 0;
uint32_t pinLockedUntil = 0;

struct Reply {
  int httpStatus;
  String body;  // empty = nothing to send back over the WebSocket
};

String envelope(JsonDocument& message) {
  JsonDocument doc;
  doc["v"] = PROTOCOL_VERSION;
  doc["message"] = message;
  String out;
  serializeJson(doc, out);
  return out;
}

Reply errorReply(int httpStatus, const char* text) {
  JsonDocument msg;
  msg["type"] = "error";
  msg["message"] = text;
  return {httpStatus, envelope(msg)};
}

Reply simpleReply(const char* type) {
  JsonDocument msg;
  msg["type"] = type;
  msg["deviceId"] = config.deviceId;
  return {200, envelope(msg)};
}

// Constant-time compare so the token can't be guessed byte by byte from timing.
bool tokenMatches(const char* token) {
  const String& expected = config.authToken;
  const size_t len = strlen(token);
  if (expected.isEmpty() || len != expected.length()) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < len; ++i) diff |= expected[i] ^ token[i];
  return diff == 0;
}

Reply handlePair(JsonObjectConst msg) {
  JsonDocument reject;
  reject["type"] = "pair_reject";

  if (!isPairingOpen()) {
    reject["reason"] = "Speaker is already paired. Press its BOOT button to allow a new phone.";
    return {403, envelope(reject)};
  }
  if (millis() < pinLockedUntil) {
    reject["reason"] = "Too many wrong PINs. Wait a minute and try again.";
    return {429, envelope(reject)};
  }

  const char* pin = msg["pin"] | "";
  const char* token = msg["authToken"] | "";
  if (config.pin != pin) {
    if (++pinFailures >= MAX_PIN_FAILURES) {
      pinFailures = 0;
      pinLockedUntil = millis() + PIN_LOCKOUT_MS;
    }
    reject["reason"] = "Wrong PIN.";
    return {403, envelope(reject)};
  }
  if (strlen(token) < 32) {
    reject["reason"] = "Invalid auth token.";
    return {400, envelope(reject)};
  }

  pinFailures = 0;
  pairingWindowEndsAt = 0;
  savePairing(token);
  AudioPlayer::enqueue(CLIP_PAIRED);
  Serial.println("[pair] paired with a new phone");

  JsonDocument ack;
  ack["type"] = "pair_ack";
  ack["deviceId"] = config.deviceId;
  ack["deviceName"] = config.deviceName;
  return {200, envelope(ack)};
}

Reply handlePayment(JsonObjectConst payment) {
  const char* status = payment["status"] | "";
  const char* paymentType = payment["paymentType"] | "";
  if (strcmp(status, "success") != 0 || strcmp(paymentType, "incoming") != 0) {
    return errorReply(422, "only successful incoming payments are announced");
  }
  if (!payment["amount"].is<uint32_t>() || payment["amount"].as<uint32_t>() == 0) {
    return errorReply(422, "amount must be a positive integer in paise");
  }

  const uint32_t amountPaise = payment["amount"].as<uint32_t>();
  ClipId clips[AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT];
  const size_t count = buildPaymentAnnouncement(
      parsePaymentSource(payment["source"] | ""), amountPaise, clips, AudioPlayer::MAX_CLIPS_PER_ANNOUNCEMENT);
  if (!AudioPlayer::enqueue(clips, count)) {
    return errorReply(503, "announcement queue is full");
  }
  Serial.printf("[payment] %lu paise from %s\n", static_cast<unsigned long>(amountPaise),
                static_cast<const char*>(payment["source"] | "?"));
  return simpleReply("payment_ack");
}

Reply handleMessage(JsonVariantConst root) {
  if ((root["v"] | 0) != PROTOCOL_VERSION) {
    return errorReply(400, "unsupported protocol version");
  }
  JsonObjectConst msg = root["message"];
  const char* type = msg["type"] | "";
  const char* deviceId = msg["deviceId"] | "";

  if (!config.deviceId.equalsIgnoreCase(deviceId)) {
    return errorReply(404, "this message is for a different speaker");
  }
  if (strcmp(type, "pair") == 0) return handlePair(msg);

  if (!tokenMatches(msg["authToken"] | "")) {
    return errorReply(401, "unauthorized: pair this phone with the speaker again");
  }
  if (strcmp(type, "heartbeat") == 0) return simpleReply("heartbeat_ack");
  if (strcmp(type, "payment") == 0) return handlePayment(msg["payment"]);
  if (strcmp(type, "test_speaker") == 0) {
    AudioPlayer::enqueue(CLIP_TEST_OK);
    return {200, ""};
  }
  return errorReply(400, "unknown message type");
}

void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    Serial.printf("[ws] phone connected from %s\n", client->remoteIP().toString().c_str());
    return;
  }
  if (type != WS_EVT_DATA) return;

  // Protocol messages are small; only whole, unfragmented text frames are valid.
  auto* info = static_cast<AwsFrameInfo*>(arg);
  if (!info->final || info->index != 0 || info->len != len || info->opcode != WS_TEXT) return;

  JsonDocument doc;
  Reply reply = deserializeJson(doc, data, len) ? errorReply(400, "invalid JSON") : handleMessage(doc.as<JsonVariantConst>());
  if (!reply.body.isEmpty()) client->text(reply.body);
}

}  // namespace

void begin() {
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);

  server.on("/message", HTTP_POST, [](AsyncWebServerRequest* request, JsonVariant& json) {
    Reply reply = handleMessage(json);
    request->send(reply.httpStatus, "application/json", reply.body.isEmpty() ? "{}" : reply.body);
  });
  server.onNotFound([](AsyncWebServerRequest* request) { request->send(404, "text/plain", "Not found"); });
  server.begin();
}

void loop() { ws.cleanupClients(MAX_WS_CLIENTS); }

void openPairingWindow() { pairingWindowEndsAt = millis() + PAIRING_WINDOW_MS; }

bool isPairingOpen() {
  return !config.isPaired() || static_cast<int32_t>(pairingWindowEndsAt - millis()) > 0;
}

bool hasPhoneConnected() { return ws.count() > 0; }

}  // namespace SpeakerServer
