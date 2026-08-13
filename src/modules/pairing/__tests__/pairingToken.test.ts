import { randomBytes } from "node:crypto";
import { bytesToHexToken, encodeQrPayload, decodeQrPayload } from "../pairingToken";

// generateAuthToken() itself calls expo-crypto's native getRandomBytesAsync,
// which isn't available under plain Jest (same boundary as expo-sqlite —
// see src/shared/db/__tests__). These tests instead exercise the pure
// hex-formatting step against real random bytes from Node's crypto module,
// which is the part of this file that's actually our logic to get right.
describe("bytesToHexToken", () => {
  it("formats 32 bytes as a 64-character lowercase hex string", () => {
    const bytes = new Uint8Array(randomBytes(32));
    const token = bytesToHexToken(bytes);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("zero-pads single-digit hex bytes", () => {
    const bytes = new Uint8Array([0, 1, 15, 255]);
    expect(bytesToHexToken(bytes)).toBe("00010fff");
  });

  it("produces different output for different byte sequences", () => {
    const a = bytesToHexToken(new Uint8Array(randomBytes(32)));
    const b = bytesToHexToken(new Uint8Array(randomBytes(32)));
    expect(a).not.toBe(b);
  });
});

describe("encodeQrPayload / decodeQrPayload", () => {
  it("round-trips a valid payload", () => {
    const payload = { deviceId: "esp32-abc123", ipAddress: "192.168.1.50", pin: "482913" };
    const decoded = decodeQrPayload(encodeQrPayload(payload));
    expect(decoded).toEqual(payload);
  });

  it("returns null for malformed JSON", () => {
    expect(decodeQrPayload("not json at all")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(decodeQrPayload(JSON.stringify({ deviceId: "x" }))).toBeNull();
  });

  it("returns null when a field has the wrong type", () => {
    expect(
      decodeQrPayload(JSON.stringify({ deviceId: "x", ipAddress: "y", pin: 123456 })),
    ).toBeNull();
  });

  it("returns null for an unrelated QR code (e.g. a URL)", () => {
    expect(decodeQrPayload("https://example.com")).toBeNull();
  });
});
