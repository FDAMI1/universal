import { NativeModule, requireNativeModule } from "expo";

export type SpeakerWifiEvents = {
  /** The speaker's network dropped (it rebooted, or went out of range). */
  onSpeakerNetworkLost: () => void;
} & Record<string, (...args: any[]) => void>;

declare class SpeakerWifiModule extends NativeModule<SpeakerWifiEvents> {
  /** False on Android 9 and older, where in-app joining isn't permitted. */
  isSupported(): boolean;
  /**
   * Shows the system picker of networks whose name starts with `ssidPrefix`,
   * joins the one the user taps, and routes this app's traffic to it.
   * Resolves with the joined network's name.
   */
  connectToSpeaker(ssidPrefix: string, timeoutMs: number): Promise<string>;
  /** Returns the phone to its normal network. */
  disconnect(): void;
  currentSsid(): string | null;
}

export default requireNativeModule<SpeakerWifiModule>("SpeakerWifi");
