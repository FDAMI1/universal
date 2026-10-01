/**
 * Talks to the setup portal the ESP32 serves on its own access point
 * ("Speaker-Setup-XXXXXX") while it has no Wi-Fi yet. Endpoints mirror
 * firmware/universal-speaker/SetupPortal.cpp.
 *
 * The phone must be joined to that access point for any of this to work, and
 * that network has no internet, so Android may keep routing through mobile
 * data — hence the deliberately explicit "couldn't reach the speaker" error.
 */
const PORTAL_BASE_URL = "http://192.168.4.1";
const REQUEST_TIMEOUT_MS = 8_000;

export interface PortalStatus {
  state: "idle" | "connecting" | "connected" | "failed";
  /** True when another phone has already claimed this speaker. */
  claimed?: boolean;
  ip?: string;
  deviceId?: string;
  pin?: string;
}

export class PortalUnreachableError extends Error {
  constructor() {
    super(
      "Couldn't reach the speaker. Make sure your phone is joined to the " +
        "Speaker-Setup Wi-Fi, and turn mobile data off while setting up.",
    );
    this.name = "PortalUnreachableError";
  }
}

async function portalFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${PORTAL_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) throw new PortalUnreachableError();
    return response;
  } catch (error) {
    if (error instanceof PortalUnreachableError) throw error;
    throw new PortalUnreachableError();
  } finally {
    clearTimeout(timeout);
  }
}

/** Nearby Wi-Fi networks as seen by the speaker, not by the phone. */
export async function scanNetworks(): Promise<string[]> {
  const networks: unknown = await (await portalFetch("/scan")).json();
  if (!Array.isArray(networks)) return [];
  return networks.filter((n): n is string => typeof n === "string" && n !== "");
}

/** Asks the speaker to join a network. Returns immediately; poll readStatus. */
export async function requestWifiConnect(
  ssid: string,
  password: string,
): Promise<void> {
  const body = new URLSearchParams({ ssid, password });
  await portalFetch("/connect", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function readStatus(): Promise<PortalStatus> {
  return (await (await portalFetch("/status")).json()) as PortalStatus;
}

/** Clears a failed attempt so the user can try different credentials without
 * power-cycling the speaker. */
export async function resetAttempt(): Promise<void> {
  await portalFetch("/reset", { method: "POST" });
}

/** Tells the speaker to leave setup mode and reboot onto the new network. */
export async function finishSetup(): Promise<void> {
  await portalFetch("/finish", { method: "POST" });
}
