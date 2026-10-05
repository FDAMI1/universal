#pragma once
#include <stdint.h>

// Lets the phone reach this speaker when the two aren't on the same Wi-Fi —
// the owner is out with their phone on mobile data while the shop keeps
// taking payments.
//
// The speaker dials OUT to a message broker on the internet and holds that
// connection open, so nothing has to reach into the shop's network: no port
// forwarding, no fixed public address, and it works behind a hotspot or
// carrier NAT. The phone publishes to the same private topic and the broker
// pushes it down here in roughly a second.
//
// Relayed messages carry the same envelope and the same auth token as local
// ones and go through the identical handler, so the relay is only a different
// road to the speaker, never a way around its checks.
namespace RelayClient {

void begin();
// Reconnects after Wi-Fi drops and reports state; cheap to call from loop().
void loop();
bool isConnected();

}  // namespace RelayClient
