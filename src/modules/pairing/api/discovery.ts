import * as Network from "expo-network";
import { DEFAULT_ESP32_PORT } from "@shared/net/protocol";

/**
 * Finds speakers on the phone's own Wi-Fi by probing every address in the
 * subnet for the firmware's unauthenticated `GET /whoami`.
 *
 * Deliberately not mDNS: ESP32 mDNS misses queries, Android stops resolving it
 * after a while, and phone hotspots and guest networks commonly drop the
 * multicast it depends on — which is exactly where this app is used. A direct
 * sweep of 254 addresses takes a few seconds and works on every network that
 * lets the phone reach the speaker at all, which it must anyway.
 */
export interface DiscoveredSpeaker {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  /** Another phone already owns it; claiming needs that phone to release it. */
  claimed: boolean;
  /** Claimable right now — never claimed, or its BOOT window is open. */
  pairingOpen: boolean;
}

/** Per-address timeout. A speaker on the same Wi-Fi answers in well under this;
 * anything slower is a host that isn't ours. */
const PROBE_TIMEOUT_MS = 1_200;
/** Probing all 254 at once exhausts the socket pool on some phones. */
const BATCH_SIZE = 32;

export function subnetAddresses(ipAddress: string): string[] {
  const parts = ipAddress.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return [];
  const prefix = parts.slice(0, 3).join(".");
  const own = Number(parts[3]);
  const hosts: string[] = [];
  for (let host = 1; host <= 254; host += 1) {
    if (host !== own) hosts.push(`${prefix}.${host}`);
  }
  return hosts;
}

export function parseWhoami(
  body: unknown,
  ipAddress: string,
): DiscoveredSpeaker | null {
  if (typeof body !== "object" || body === null) return null;
  const data = body as Record<string, unknown>;
  if (data.product !== "universal-speaker") return null;
  if (typeof data.deviceId !== "string" || data.deviceId === "") return null;
  return {
    deviceId: data.deviceId,
    deviceName:
      typeof data.deviceName === "string" && data.deviceName
        ? data.deviceName
        : "Universal Speaker",
    ipAddress,
    claimed: data.claimed === true,
    pairingOpen: data.pairingOpen === true,
  };
}

async function probe(ipAddress: string): Promise<DiscoveredSpeaker | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(
      `http://${ipAddress}:${DEFAULT_ESP32_PORT}/whoami`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    return parseWhoami(await response.json(), ipAddress);
  } catch {
    // Almost every address in the subnet fails here; that's the normal case.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Sweeps the phone's subnet. `onFound` fires as each speaker answers, so the
 * UI can show the first one without waiting for the whole sweep. */
export async function discoverSpeakers(
  onFound?: (speaker: DiscoveredSpeaker) => void,
): Promise<DiscoveredSpeaker[]> {
  const ip = await Network.getIpAddressAsync();
  const hosts = subnetAddresses(ip);
  const found: DiscoveredSpeaker[] = [];

  for (let i = 0; i < hosts.length; i += BATCH_SIZE) {
    const results = await Promise.all(hosts.slice(i, i + BATCH_SIZE).map(probe));
    for (const speaker of results) {
      if (!speaker) continue;
      found.push(speaker);
      onFound?.(speaker);
    }
  }
  return found;
}

/** Finds one known speaker again after its address changed — the reason a
 * working setup silently stops working after a router reboot. */
export async function findSpeakerById(
  deviceId: string,
): Promise<DiscoveredSpeaker | null> {
  const speakers = await discoverSpeakers();
  return (
    speakers.find(
      (s) => s.deviceId.toLowerCase() === deviceId.toLowerCase(),
    ) ?? null
  );
}
