#include "AudioPlayer.h"
#include <Arduino.h>
#include <string.h>
#include "driver/dac_continuous.h"

namespace AudioPlayer {
namespace {

constexpr uint8_t DAC_MIDPOINT = 128;
constexpr size_t DMA_DESC_NUM = 4;
constexpr size_t DMA_BUF_SIZE = 1024;
constexpr size_t QUEUE_LENGTH = 8;
constexpr uint32_t GAP_BETWEEN_CLIPS_MS = 40;

struct Announcement {
  ClipId clips[MAX_CLIPS_PER_ANNOUNCEMENT];
  uint8_t count;
};

dac_continuous_handle_t dac = nullptr;
QueueHandle_t queue = nullptr;
volatile bool busy = false;
uint8_t gain = 100;
uint8_t chunk[DMA_BUF_SIZE];

void writeChunk(size_t len) {
  size_t loaded = 0;
  dac_continuous_write(dac, chunk, len, &loaded, -1);
}

void writeSilence(size_t samples) {
  memset(chunk, DAC_MIDPOINT, sizeof(chunk));
  while (samples > 0) {
    const size_t n = samples < sizeof(chunk) ? samples : sizeof(chunk);
    writeChunk(n);
    samples -= n;
  }
}

void playClip(ClipId id) {
  const ClipData& clip = CLIP_TABLE[id];
  for (uint32_t offset = 0; offset < clip.length; offset += sizeof(chunk)) {
    const size_t n = min<size_t>(sizeof(chunk), clip.length - offset);
    for (size_t i = 0; i < n; ++i) {
      const int centred = static_cast<int>(clip.data[offset + i]) - DAC_MIDPOINT;
      chunk[i] = static_cast<uint8_t>(DAC_MIDPOINT + centred * gain / 100);
    }
    writeChunk(n);
  }
}

void playerTask(void*) {
  Announcement a;
  for (;;) {
    if (xQueueReceive(queue, &a, portMAX_DELAY) != pdTRUE) continue;
    busy = true;
    for (uint8_t i = 0; i < a.count; ++i) {
      playClip(a.clips[i]);
      writeSilence(CLIP_SAMPLE_RATE * GAP_BETWEEN_CLIPS_MS / 1000);
    }
    // In synchronous mode the DMA keeps cycling its descriptors after the last
    // write, so fill every one of them with silence to stop a trailing buzz.
    writeSilence(DMA_DESC_NUM * DMA_BUF_SIZE);
    busy = uxQueueMessagesWaiting(queue) > 0;
  }
}

}  // namespace

bool begin(uint8_t gainPercent) {
  gain = gainPercent > 100 ? 100 : gainPercent;

  dac_continuous_config_t config = {
      .chan_mask = DAC_CHANNEL_MASK_CH0,  // GPIO25
      .desc_num = DMA_DESC_NUM,
      .buf_size = DMA_BUF_SIZE,
      .freq_hz = CLIP_SAMPLE_RATE,
      .offset = 0,
      // PLL_D2 can't divide down to 16 kHz (its floor is ~19.6 kHz); APLL can.
      .clk_src = DAC_DIGI_CLK_SRC_APLL,
      .chan_mode = DAC_CHANNEL_MODE_SIMUL,
  };
  if (dac_continuous_new_channels(&config, &dac) != ESP_OK) return false;
  if (dac_continuous_enable(dac) != ESP_OK) return false;

  queue = xQueueCreate(QUEUE_LENGTH, sizeof(Announcement));
  if (!queue) return false;

  // Ease the output from 0 V up to mid-rail over ~50 ms so boot doesn't pop.
  constexpr size_t rampLen = CLIP_SAMPLE_RATE / 20;
  static_assert(rampLen <= DMA_BUF_SIZE, "ramp must fit in one chunk");
  for (size_t i = 0; i < rampLen; ++i) chunk[i] = i * DAC_MIDPOINT / rampLen;
  writeChunk(rampLen);
  writeSilence(DMA_DESC_NUM * DMA_BUF_SIZE);
  return xTaskCreatePinnedToCore(playerTask, "audio", 4096, nullptr, 3, nullptr, 1) == pdPASS;
}

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
