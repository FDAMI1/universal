import { useCallback, useState } from "react";
import { decodeQrPayload } from "../pairingToken";
import { pairWithDevice } from "../api/pairingApi";
import type { DiscoveredSpeaker } from "../api/discovery";
import { useDeviceStore } from "@shared/store/useDeviceStore";

export function useDevicePairing() {
  const setPairedDevice = useDeviceStore((state) => state.setPairedDevice);
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pairFromQrData = useCallback(
    async (raw: string) => {
      setError(null);
      const payload = decodeQrPayload(raw);
      if (!payload) {
        setError("That QR code isn't a valid pairing code for this device.");
        return false;
      }

      setIsPairing(true);
      try {
        const result = await pairWithDevice(payload);
        setPairedDevice(result.device);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Pairing failed");
        return false;
      } finally {
        setIsPairing(false);
      }
    },
    [setPairedDevice],
  );

  /** Claims a speaker the app discovered on the network. Unclaimed speakers
   * need no PIN; one that's already owned still does. */
  const pairDiscovered = useCallback(
    async (speaker: DiscoveredSpeaker, pin = "") => {
      return pairFromQrData(
        JSON.stringify({
          deviceId: speaker.deviceId,
          ipAddress: speaker.ipAddress,
          pin,
        }),
      );
    },
    [pairFromQrData],
  );

  const pairManually = useCallback(
    async (deviceId: string, ipAddress: string, pin: string) => {
      return pairFromQrData(JSON.stringify({ deviceId, ipAddress, pin }));
    },
    [pairFromQrData],
  );

  return { isPairing, error, pairFromQrData, pairManually, pairDiscovered };
}
