# ESP32 Sound Box Firmware

Receives payments from the Universal Speaker app over Wi-Fi and announces them in Hindi,
e.g. "भुगतान प्राप्त हुआ, पाँच सौ रुपये".

## Hardware

ESP32 38-pin dev board → PAM8403 amplifier → speaker, using the ESP32's built-in DAC.

| From            | To                                                       |
| --------------- | -------------------------------------------------------- |
| ESP32 VIN (5V)  | PAM8403 +5V                                              |
| ESP32 GND       | PAM8403 GND (power and input GND)                        |
| ESP32 GPIO25    | 1kΩ resistor, then a 1µF capacitor, then PAM8403 L input |
| ESP32 GND       | PAM8403 input ground (the `G` / `⊥` pin beside L and R)  |
| PAM8403 L+ / L− | Speaker wires                                            |

- Use **one** resistor and capacitor in total, not one at each end.
- Capacitor:
  - A ceramic one (marked `105`) has no polarity, so it can go either way.
  - An electrolytic one (a small can with a stripe) needs its **+ leg toward the PAM8403**. Its stripe marks the − leg, which goes toward the resistor.
- Never connect a speaker wire to GND. PAM8403 outputs are bridged.
- If the sound distorts, lower the volume in the app (Settings → Volume) or use a bigger
  resistor (4.7kΩ). The volume the speaker uses before an app ever sets one is
  `DEFAULT_VOLUME_PERCENT` in `DeviceConfig.h`.

## Flashing (VS Code + PlatformIO)

The complete source is every file in `universal-speaker/`, not only the `.ino`. `platformio.ini` already sets the board, the Huge APP partition and the libraries.

1. VS Code → Extensions → install **PlatformIO IDE**. Restart VS Code.
2. File → Open Folder → select `firmware` (the folder containing `platformio.ini`).
3. The first build downloads about 3 GB of ESP32 tools into `C:\Users\<you>\.platformio`. If C: is low on space, first set a Windows user environment variable `PLATFORMIO_CORE_DIR=E:\.platformio`, then restart VS Code.
4. Bottom status bar: **✓ Build**, then **→ Upload**. If it hangs on "Connecting…", hold **BOOT** until the upload starts.
5. Click the **plug icon** (Serial Monitor, 115200) to see the Device ID, IP and PIN.

If the upload finds no COM port, install the USB driver for the chip on your board: **CP210x** or **CH340**.

## Flashing (Arduino IDE 2.x)

1. Boards Manager: install **esp32 by Espressif Systems** (3.3.x).
2. Library Manager: install **ESP Async WebServer** (by ESP32Async), **Async TCP** (by ESP32Async), and **ArduinoJson**.
3. Open `firmware/universal-speaker/universal-speaker.ino`.
4. Tools menu:
   - Board: **ESP32 Dev Module**
   - Partition Scheme: **Huge APP (3MB No OTA/1MB SPIFFS)** (required: the voice clips are built into the firmware)
5. Click Upload. If it hangs on "Connecting…", hold the **BOOT** button until the upload starts.
6. Open Serial Monitor at **115200** baud to see the Device ID, IP and PIN.

## First-time setup

1. Power on. The speaker says "सेटअप मोड चालू है…" and the LED blinks fast.
2. On your phone, join the Wi-Fi **Speaker-Setup-XXXXXX**. The setup page opens automatically, or open `http://192.168.4.1`.
3. Pick your Wi-Fi or hotspot and enter the password. The page then shows the **Device ID, IP address and PIN**, and the speaker reads the IP and PIN aloud.
4. Switch your phone back to the same Wi-Fi. In the app, go to **Devices → enter manually**, type the three values, and pair.
5. The speaker says "फ़ोन सफलतापूर्वक जुड़ गया". Use **Test Speaker** on the Dashboard to check.

## Buttons and LED

- **BOOT, short press:** reads out the IP and PIN, and allows a new phone to pair for 3 minutes.
- **BOOT, hold 8 seconds:** factory reset. Forgets the Wi-Fi and the paired phone.
- **LED:**
  - fast blink: setup mode
  - slow blink: waiting for the phone
  - solid: phone connected

If the router gives the speaker a new IP, press BOOT to hear it and pair again. To avoid this, reserve the IP in your router's DHCP settings.

## No sound?

Upload `firmware/tools/dac_tone_test/dac_tone_test.ino`. It beeps once a second on GPIO25
and uses nothing else, so it separates a wiring fault from a firmware one:

- **No beep:** amplifier, speaker or wiring. With the amp powered, touching the L input pin
  with a finger should buzz through the speaker. Silence there means the amp, its power or
  the speaker; buzz means the amp is fine and the fault is between GPIO25 and that pin.
- **Beep, but the main sketch is silent:** the main sketch only speaks at certain moments.
  Press BOOT to make it read out the IP and PIN. Check the Serial Monitor for
  `[audio] DAC init failed` and confirm the partition scheme is Huge APP.

## Changing the voice

```
pip install edge-tts imageio-ffmpeg
python firmware/tools/generate_clips.py                 # female (Swara)
python firmware/tools/generate_clips.py --voice hi-IN-MadhurNeural   # male
```

This regenerates `clips.h` and `clips.cpp`. Upload the sketch again afterwards.

## Protocol

Matches `src/shared/net/protocol.ts`:

- WebSocket: `ws://<ip>:8080/`
- HTTP fallback: `POST http://<ip>:8080/message`
- Every message is `{ "v": 1, "message": {...} }`.
- The app sets the volume with `set_volume` (0-100); the speaker keeps it across reboots.
- Pairing checks the PIN. All other messages need the auth token the phone sent when it paired.
