#pragma once
#include <stddef.h>
#include <stdint.h>
#include "clips.h"

// Plays sequences of clips through the ESP32 internal DAC (GPIO25) using the
// DMA-driven dac_continuous driver. Announcements are queued and played one
// after another on a background task, so a burst of payments never overlaps.
namespace AudioPlayer {

constexpr size_t MAX_CLIPS_PER_ANNOUNCEMENT = 32;

// gainPercent scales the signal around the DAC midpoint (100 = full swing).
// Lower it if the amplifier distorts and has no volume knob.
bool begin(uint8_t gainPercent);

// Returns false if the queue is full (announcement dropped).
bool enqueue(const ClipId* clips, size_t count);
bool enqueue(ClipId clip);

bool isBusy();

}  // namespace AudioPlayer
