// Hardware check: plays a 1 kHz beep out of GPIO25 once a second, forever.
// Upload this instead of the main sketch when the speaker stays silent. It uses
// no Wi-Fi, no clips and no partition scheme, so anything it needs is a wire.
// Silent here = amplifier, speaker or wiring. Audible here = look at the app side.

constexpr int DAC_PIN = 25;
constexpr int TONE_HZ = 1000;
constexpr int BEEP_MS = 300;

// 16 samples of a sine, centred on the DAC midpoint (128).
const uint8_t SINE[16] = {128, 176, 218, 245, 255, 245, 218, 176, 128, 79, 37, 10, 0, 10, 37, 79};

void setup() {
  Serial.begin(115200);
  Serial.println("\nDAC tone test: 1 kHz beep on GPIO25 every second.");
}

void loop() {
  Serial.println("beep");
  const uint32_t until = millis() + BEEP_MS;
  while (millis() < until) {
    for (uint8_t i = 0; i < 16; ++i) {
      dacWrite(DAC_PIN, SINE[i]);
      delayMicroseconds(1000000 / (TONE_HZ * 16));
    }
  }
  dacWrite(DAC_PIN, 128);  // rest at mid-rail, same as the real firmware
  delay(1000);
}
