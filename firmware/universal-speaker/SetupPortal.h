#pragma once

// First-time Wi-Fi setup. The speaker opens an open Wi-Fi network named
// "Speaker-Setup-XXXXXX"; joining it pops up a page (captive portal) where the
// user picks their Wi-Fi. Once connected, the page shows the Device ID, IP and
// PIN to enter in the app, and the speaker reads them aloud too.
namespace SetupPortal {

void begin();
void loop();

}  // namespace SetupPortal
