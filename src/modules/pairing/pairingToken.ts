import * as Crypto from "expo-crypto";

/** Pure formatting step, kept separate from the native random-byte call so
 * it can be unit tested without relying on expo-crypto's native module
 * (unavailable outside a real device/emulator). */
export function bytesToHexToken(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generates a cryptographically random auth token shared between the phone
 * and a paired ESP32, per PDR Module 6 ("Shared authentication token"). */
export async function generateAuthToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return bytesToHexToken(bytes);
}

/** The QR code payload the ESP32 displays/broadcasts during setup. The phone
 * scans this to learn the device's IP and pairing PIN without either side
 * needing to already share a token. */
export interface QrPairingPayload {
  deviceId: string;
  ipAddress: string;
  pin: string;
}

export function encodeQrPayload(payload: QrPairingPayload): string {
  return JSON.stringify(payload);
}

export function decodeQrPayload(raw: string): QrPairingPayload | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.deviceId === "string" &&
      typeof parsed?.ipAddress === "string" &&
      typeof parsed?.pin === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
