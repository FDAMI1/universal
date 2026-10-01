import { Linking, Platform } from "react-native";
import { SpeakerWifi } from "@native/speaker-wifi";

/** Every speaker's setup network starts with this (e.g. Speaker-Setup-1BA0A4). */
export const SETUP_SSID_PREFIX = "Speaker-Setup-";

/** Android gives the user time to pick the speaker in its picker, so this is
 * generous compared with an ordinary network request. */
const JOIN_TIMEOUT_MS = 60_000;

export function canJoinFromApp(): boolean {
  return Platform.OS === "android" && SpeakerWifi.isSupported();
}

/**
 * Joins a nearby speaker's setup network and routes the app's requests to it.
 * Android shows its own picker of matching networks — that tap is required by
 * the OS and can't be done for the user.
 */
export async function joinSpeakerNetwork(): Promise<string> {
  return SpeakerWifi.connectToSpeaker(SETUP_SSID_PREFIX, JOIN_TIMEOUT_MS);
}

/** Hands the phone back to its normal network. Always safe to call. */
export function leaveSpeakerNetwork(): void {
  try {
    SpeakerWifi.disconnect();
  } catch {
    // Nothing was bound; that's the state we wanted anyway.
  }
}

export function joinedSsid(): string | null {
  try {
    return SpeakerWifi.currentSsid();
  } catch {
    return null;
  }
}

/** Fallback for phones that can't join from inside the app (Android 9 and
 * older): drop the user straight into Wi-Fi settings. */
export async function openWifiSettings(): Promise<void> {
  if (Platform.OS === "android") {
    await Linking.sendIntent("android.settings.WIFI_SETTINGS");
    return;
  }
  await Linking.openSettings();
}
