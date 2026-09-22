#pragma once
#include <stdint.h>

// The phone-facing server on port 8080 (PDR Module 7), speaking the protocol
// in src/shared/net/protocol.ts:
//   ws://<ip>:8080/          WebSocket, primary
//   POST http://<ip>:8080/message   HTTP fallback, same JSON envelope
namespace SpeakerServer {

constexpr uint16_t PORT = 8080;

void begin();
void loop();

// Pairing is always open while unpaired. Once paired, re-pairing (e.g. a new
// phone) is only accepted for a few minutes after the BOOT button is pressed,
// so nobody else on the Wi-Fi can take over the speaker.
void openPairingWindow();
bool isPairingOpen();

bool hasPhoneConnected();

}  // namespace SpeakerServer
