import { computeReconnectDelayMs } from "../Esp32Connection";
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../protocol";

describe("computeReconnectDelayMs", () => {
  it("returns the base delay on the first attempt", () => {
    expect(computeReconnectDelayMs(0)).toBe(RECONNECT_BASE_DELAY_MS);
  });

  it("doubles with each attempt", () => {
    expect(computeReconnectDelayMs(1)).toBe(RECONNECT_BASE_DELAY_MS * 2);
    expect(computeReconnectDelayMs(2)).toBe(RECONNECT_BASE_DELAY_MS * 4);
    expect(computeReconnectDelayMs(3)).toBe(RECONNECT_BASE_DELAY_MS * 8);
  });

  it("caps at the maximum delay", () => {
    expect(computeReconnectDelayMs(20)).toBe(RECONNECT_MAX_DELAY_MS);
  });

  it("never exceeds the maximum delay for any attempt count", () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      expect(computeReconnectDelayMs(attempt)).toBeLessThanOrEqual(
        RECONNECT_MAX_DELAY_MS,
      );
    }
  });
});
