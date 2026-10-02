import { useEffect, useRef } from "react";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { useSettingsStore } from "@shared/store/useSettingsStore";
import { useActivityLogStore } from "@shared/store/useActivityLogStore";
import { Esp32Connection } from "./Esp32Connection";
import { DEFAULT_ESP32_PORT } from "./protocol";
import { generateId } from "@shared/utils/id";
import { findSpeakerById } from "@modules/pairing/api/discovery";

let activeConnection: Esp32Connection | null = null;

/** The single long-lived connection to the currently paired device, if any.
 * Read by the payment pipeline to actually send announcements — kept as a
 * module-level singleton (not React state) so it survives re-renders and
 * background/foreground transitions without being torn down and rebuilt. */
export function getActiveEsp32Connection(): Esp32Connection | null {
  return activeConnection;
}

/** Pushes the app's volume setting (0-1) to the speaker as a 0-100 percentage.
 * No-ops when nothing is paired or the socket is down; the next connect
 * re-sends it anyway. */
export async function sendVolumeToSpeaker(): Promise<void> {
  const device = useDeviceStore.getState().pairedDevice;
  if (!activeConnection || !device) return;
  try {
    await activeConnection.send({
      type: "set_volume",
      deviceId: device.id,
      authToken: device.authToken,
      volume: Math.round(useSettingsStore.getState().volume * 100),
    });
  } catch {
    // Volume is cosmetic — never let it surface as an error to the user.
  }
}

/** Routers hand out new addresses after a power cut, which used to mean a
 * working setup silently stopped working until the user re-paired by hand.
 * On a failure, sweep the network for the same Device ID and follow it. */
const RELOCATE_COOLDOWN_MS = 60_000;

/**
 * Establishes and tears down the ESP32 connection as pairing state changes.
 * Mount once near the app root.
 */
export function useEsp32ConnectionManager() {
  const pairedDevice = useDeviceStore((state) => state.pairedDevice);
  const setConnectionStatus = useDeviceStore(
    (state) => state.setConnectionStatus,
  );
  const connectionRef = useRef<Esp32Connection | null>(null);
  const lastRelocateAt = useRef(0);

  useEffect(() => {
    if (!pairedDevice) {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      activeConnection = null;
      setConnectionStatus("disconnected");
      return;
    }

    const connection = new Esp32Connection(
      pairedDevice.ipAddress,
      DEFAULT_ESP32_PORT,
      pairedDevice.id,
      pairedDevice.authToken,
    );
    connectionRef.current = connection;
    activeConnection = connection;

    const relocate = async () => {
      if (Date.now() - lastRelocateAt.current < RELOCATE_COOLDOWN_MS) return;
      lastRelocateAt.current = Date.now();
      const found = await findSpeakerById(pairedDevice.id).catch(() => null);
      if (!found || found.ipAddress === pairedDevice.ipAddress) return;
      useActivityLogStore.getState().addEntry({
        id: generateId(),
        type: "connection",
        at: new Date().toISOString(),
        message: `Speaker moved to ${found.ipAddress}; reconnecting`,
      });
      // Writing the new address re-runs this effect with a fresh connection.
      useDeviceStore.getState().setPairedDevice({
        ...pairedDevice,
        ipAddress: found.ipAddress,
      });
    };

    const unsubscribe = connection.addListener((event) => {
      if (event.type === "status") {
        setConnectionStatus(event.status);
        // The speaker keeps its own volume across reboots, so re-send ours on
        // every (re)connect to keep the app's slider and the box in step.
        if (event.status === "connected") {
          lastRelocateAt.current = 0;
          void sendVolumeToSpeaker();
        }
        if (event.status === "error") void relocate();
      }
      if (event.type === "log") {
        useActivityLogStore.getState().addEntry({
          id: generateId(),
          type: "connection",
          at: new Date().toISOString(),
          message: event.message,
        });
      }
    });

    connection.connect();

    return () => {
      unsubscribe();
      connection.disconnect();
      if (activeConnection === connection) activeConnection = null;
    };
  }, [pairedDevice, setConnectionStatus]);
}
