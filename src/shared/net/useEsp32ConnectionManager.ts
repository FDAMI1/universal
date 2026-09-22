import { useEffect, useRef } from "react";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { useActivityLogStore } from "@shared/store/useActivityLogStore";
import { Esp32Connection } from "./Esp32Connection";
import { DEFAULT_ESP32_PORT } from "./protocol";
import { generateId } from "@shared/utils/id";

let activeConnection: Esp32Connection | null = null;

/** The single long-lived connection to the currently paired device, if any.
 * Read by the payment pipeline to actually send announcements — kept as a
 * module-level singleton (not React state) so it survives re-renders and
 * background/foreground transitions without being torn down and rebuilt. */
export function getActiveEsp32Connection(): Esp32Connection | null {
  return activeConnection;
}

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

    const unsubscribe = connection.addListener((event) => {
      if (event.type === "status") {
        setConnectionStatus(event.status);
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
