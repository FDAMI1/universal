#include "AudioPlayer.h"
#include <Arduino.h>
#include <string.h>
#include "driver/dac_oneshot.h"
#include "driver/rtc_io.h"
#include "soc/rtc_io_reg.h"
#include "soc/sens_reg.h"

namespace AudioPlayer {
namespace {

// Audio is clocked out by a hardware timer that writes one sample straight to
// the DAC register, rather than by the dac_continuous DMA driver. On
// arduino-esp32 3.x that driver's descriptors never free up: every write
// returns ESP_ERR_TIMEOUT having played nothing (espressif/arduino-esp32
// #10851). A 16 kHz timer is a few microseconds of work per tick and depends
// on nothing but the DAC pad itself.
constexpr uint8_t DAC_MIDPOINT = 128;
constexpr int DAC_PIN = 25;  // DAC channel 1
constexpr size_t QUEUE_LENGTH = 8;
constexpr uint32_t GAP_BETWEEN_CLIPS_MS = 40;

// A quarter second of slack between the feeding task and the timer. Big enough
// that Wi-Fi work never starves playback, small enough to stay in RAM cheaply.
constexpr size_t RING_SIZE = 4096;
constexpr size_t RING_MASK = RING_SIZE - 1;
static_assert((RING_SIZE & RING_MASK) == 0, "ring size must be a power of two");

struct Announcement {
  ClipId clips[MAX_CLIPS_PER_ANNOUNCEMENT];
  uint8_t count;
};

QueueHandle_t queue = nullptr;
hw_timer_t* sampleTimer = nullptr;
dac_oneshot_handle_t dacPad = nullptr;
volatile bool busy = false;
uint8_t gain = 100;

// Single producer (the audio task), single consumer (the timer ISR), so plain
// volatile indices are enough — no lock needed.
uint8_t ring[RING_SIZE];
volatile size_t ringHead = 0;  // written by the task
volatile size_t ringTail = 0;  // written by the ISR

inline size_t ringAvailable() { return (ringHead - ringTail) & RING_MASK; }
inline size_t ringSpace() { return RING_MASK - ringAvailable(); }

// Writes the DAC's output register directly. dacWrite() takes a lock and
// touches flash, neither of which is safe from an interrupt.
inline void IRAM_ATTR writeDac(uint8_t value) {
  REG_SET_FIELD(RTC_IO_PAD_DAC1_REG, RTC_IO_PDAC1_DAC, value);
}

/** Powers the analog output up for an announcement. */
void wakeDac() {
  if (dacPad != nullptr) return;
  dac_oneshot_config_t padConfig = {.chan_id = DAC_CHAN_0};
  if (dac_oneshot_new_channel(&padConfig, &dacPad) == ESP_OK) {
    dac_oneshot_output_voltage(dacPad, DAC_MIDPOINT);
  }
}

/** Shuts it down again and pins the output low, so nothing is left floating
 * for the radio to couple into. */
void sleepDac() {
  if (dacPad == nullptr) return;
  dac_oneshot_del_channel(dacPad);
  dacPad = nullptr;
  // GPIO25 is an RTC pad: deleting the DAC channel leaves it in analog mode,
  // where pinMode() has no effect and the pin floats — an aerial feeding the
  // amplifier. Hand it back to the digital mux first, then it can be driven.
  rtc_gpio_deinit(static_cast<gpio_num_t>(DAC_PIN));
  pinMode(DAC_PIN, OUTPUT);
  digitalWrite(DAC_PIN, LOW);
}

void IRAM_ATTR onSampleTick() {
  if (ringHead == ringTail) {
    writeDac(DAC_MIDPOINT);  // nothing queued: rest at mid-rail, silent
    return;
  }
  writeDac(ring[ringTail]);
  ringTail = (ringTail + 1) & RING_MASK;
}

/** Blocks until the ring has room, then appends one sample. */
void pushSample(uint8_t sample) {
  while (ringSpace() == 0) vTaskDelay(1);
  ring[ringHead] = sample;
  ringHead = (ringHead + 1) & RING_MASK;
}

void playSilence(size_t samples) {
  for (size_t i = 0; i < samples; ++i) pushSample(DAC_MIDPOINT);
}

void playClip(ClipId id) {
  const ClipData& clip = CLIP_TABLE[id];
  for (uint32_t i = 0; i < clip.length; ++i) {
    const int centred = static_cast<int>(clip.data[i]) - DAC_MIDPOINT;
    pushSample(static_cast<uint8_t>(DAC_MIDPOINT + centred * gain / 100));
  }
}

void playerTask(void*) {
  Announcement a;
  for (;;) {
    if (xQueueReceive(queue, &a, portMAX_DELAY) != pdTRUE) continue;
    busy = true;
    // The timer only runs while there is audio. Ticking 16,000 times a second
    // through silence gave an idle tick on the speaker and bought nothing.
    wakeDac();
    timerStart(sampleTimer);
    for (uint8_t i = 0; i < a.count; ++i) {
      playClip(a.clips[i]);
      playSilence(CLIP_SAMPLE_RATE * GAP_BETWEEN_CLIPS_MS / 1000);
    }
    // The queue is only empty once the timer has drained what we queued, so
    // isBusy() stays true until the speaker has actually stopped talking.
    while (ringAvailable() > 0) vTaskDelay(1);
    busy = uxQueueMessagesWaiting(queue) > 0;
    if (!busy) {
      timerStop(sampleTimer);
      sleepDac();
    }
  }
}

}  // namespace

bool begin(uint8_t gainPercent) {
  gain = gainPercent > 100 ? 100 : gainPercent;

  // Starts silent: the output is only powered while something is being said.
  pinMode(DAC_PIN, OUTPUT);
  digitalWrite(DAC_PIN, LOW);

  queue = xQueueCreate(QUEUE_LENGTH, sizeof(Announcement));
  if (!queue) return false;

  // 80 MHz / 5000 gives exactly the clips' 16 kHz, so playback is never
  // slightly fast or slow.
  sampleTimer = timerBegin(CLIP_SAMPLE_RATE);
  if (!sampleTimer) return false;
  timerAttachInterrupt(sampleTimer, &onSampleTick);
  timerAlarm(sampleTimer, 1, true, 0);
  timerStop(sampleTimer);  // silent until there is something to say

  return xTaskCreatePinnedToCore(playerTask, "audio", 4096, nullptr, 3, nullptr, 1) == pdPASS;
}

void setGain(uint8_t gainPercent) { gain = gainPercent > 100 ? 100 : gainPercent; }

bool enqueue(const ClipId* clips, size_t count) {
  if (!queue || count == 0) return false;
  Announcement a;
  a.count = count > MAX_CLIPS_PER_ANNOUNCEMENT ? MAX_CLIPS_PER_ANNOUNCEMENT : count;
  memcpy(a.clips, clips, a.count * sizeof(ClipId));
  if (xQueueSend(queue, &a, 0) != pdTRUE) return false;
  busy = true;
  return true;
}

bool enqueue(ClipId clip) { return enqueue(&clip, 1); }

bool isBusy() { return busy; }

}  // namespace AudioPlayer
