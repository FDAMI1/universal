import { Esp32Connection } from "@shared/net/Esp32Connection";
import { QrPairingPayload, generateAuthToken } from "../pairingToken";
import { DEFAULT_ESP32_PORT } from "@shared/net/protocol";
import { PairedDevice } from "@shared/store/useDeviceStore";

export interface PairResult {
  device: PairedDevice;
}

/**
 * Completes the handshake with an ESP32 discovered via QR (or entered
 * manually): connects, sends a `pair` message with a freshly generated auth
 * token + the PIN shown on the device, and resolves once the device
 * acknowledges. The connection is torn down after pairing — the caller
 * establishes a fresh long-lived Esp32Connection once the device is saved.
 */
export async function pairWithDevice(
  payload: QrPairingPayload,
  timeoutMs = 10_000,
): Promise<PairResult> {
  const authToken = await generateAuthToken();

  return new Promise((resolve, reject) => {
    const connection = new Esp32Connection(
      payload.ipAddress,
      DEFAULT_ESP32_PORT,
      payload.deviceId,
      authToken,
    );

    const timeout = setTimeout(() => {
      connection.disconnect();
      reject(
        new Error(
          "Pairing timed out — check the device is powered on and nearby",
        ),
      );
    }, timeoutMs);

    const unsubscribe = connection.addListener((event) => {
      if (event.type === "status" && event.status === "connected") {
        connection.send({
          type: "pair",
          deviceId: payload.deviceId,
          authToken,
          pin: payload.pin,
        });
      }

      if (event.type === "message") {
        if (event.message.type === "pair_ack") {
          clearTimeout(timeout);
          unsubscribe();
          connection.disconnect();
          resolve({
            device: {
              id: payload.deviceId,
              name: event.message.deviceName,
              ipAddress: payload.ipAddress,
              authToken,
              pairedAt: new Date().toISOString(),
            },
          });
        } else if (event.message.type === "pair_reject") {
          clearTimeout(timeout);
          unsubscribe();
          connection.disconnect();
          reject(new Error(event.message.reason));
        }
      }

      if (event.type === "status" && event.status === "error") {
        clearTimeout(timeout);
        unsubscribe();
        connection.disconnect();
        reject(
          new Error(
            "Could not reach the device — check it's on the same network",
          ),
        );
      }
    });

    connection.connect();
  });
}
