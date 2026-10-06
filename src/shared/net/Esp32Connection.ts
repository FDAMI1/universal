import {
  ClientMessage,
  ServerMessage,
  wrapMessage,
  isCompatibleVersion,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RELAY_TIMEOUT_MS,
  RelayDetails,
} from "./protocol";
import { publishOverRelay, requestOverRelay, RelayTarget } from "./mqttPublish";

/** Re-checking the relay more often than this just burns the phone's data. */
const RELAY_PROBE_INTERVAL_MS = 20_000;
import { ConnectionStatus } from "@shared/store/useDeviceStore";

export type ConnectionEvent =
  | { type: "status"; status: ConnectionStatus }
  | { type: "message"; message: ServerMessage }
  | { type: "log"; message: string };

type Listener = (event: ConnectionEvent) => void;

/** Exponential backoff, capped at RECONNECT_MAX_DELAY_MS. Exported as a pure
 * function so the backoff curve can be tested without real timers. */
export function computeReconnectDelayMs(attempt: number): number {
  return Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** attempt,
    RECONNECT_MAX_DELAY_MS,
  );
}

/**
 * WebSocket-primary, HTTP-fallback connection to a paired ESP32 (PDR Module
 * 7). Auto-reconnects with exponential backoff and sends a heartbeat while
 * connected; if the server doesn't ack a heartbeat in time, the socket is
 * considered dead and reconnection begins.
 *
 * HTTP fallback only covers `send()` — a plain HTTP POST can deliver a
 * one-off message (e.g. when the socket is mid-reconnect) but can't receive
 * push updates from the ESP32, which is why WebSocket stays primary.
 */
export class Esp32Connection {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private currentStatus: ConnectionStatus = "disconnected";
  private relay: RelayDetails | undefined;

  constructor(
    private ipAddress: string,
    private port: number,
    private deviceId: string,
    private authToken: string,
  ) {}

  updateTarget(ipAddress: string, port: number): void {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  addListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ConnectionEvent): void {
    if (event.type === "status") this.currentStatus = event.status;
    this.listeners.forEach((listener) => listener(event));
  }

  connect(): void {
    this.manuallyClosed = false;
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.emit({ type: "status", status: "disconnected" });
  }

  private openSocket(): void {
    this.emit({ type: "status", status: "connecting" });
    const url = `ws://${this.ipAddress}:${this.port}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (error) {
      this.emit({
        type: "log",
        message: `failed to open socket: ${String(error)}`,
      });
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit({ type: "status", status: "connected" });
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      const parsed = this.parseServerMessage(event.data);
      if (parsed?.type === "heartbeat_ack") {
        this.clearHeartbeatTimeout();
      }
      if (parsed) {
        this.emit({ type: "message", message: parsed });
      }
    };

    socket.onerror = () => {
      this.emit({ type: "status", status: "error" });
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      if (!this.manuallyClosed) {
        this.emit({ type: "status", status: "disconnected" });
        this.scheduleReconnect();
      }
    };
  }

  private parseServerMessage(raw: unknown): ServerMessage | null {
    if (typeof raw !== "string") return null;
    try {
      const envelope = JSON.parse(raw);
      if (!isCompatibleVersion(envelope?.v)) {
        this.emit({
          type: "log",
          message: `incompatible protocol version: ${envelope?.v}`,
        });
        return null;
      }
      return envelope.message as ServerMessage;
    } catch {
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed) return;
    this.clearReconnectTimer();
    const delay = computeReconnectDelayMs(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
    // The local socket is down. If the speaker can be reached through the
    // relay instead, say so, rather than reporting "disconnected" to someone
    // whose payments are in fact still being announced.
    void this.probeRelay();
  }

  private relayProbeInFlight = false;
  private lastRelayProbeAt = 0;

  /** Asks the speaker, via the broker, whether it is there. */
  private async probeRelay(): Promise<void> {
    if (!this.relay || this.relayProbeInFlight) return;
    if (Date.now() - this.lastRelayProbeAt < RELAY_PROBE_INTERVAL_MS) return;
    this.relayProbeInFlight = true;
    this.lastRelayProbeAt = Date.now();
    try {
      const reply = await requestOverRelay(
        this.relayTarget(),
        JSON.stringify(
          wrapMessage({
            type: "heartbeat",
            deviceId: this.deviceId,
            authToken: this.authToken,
          }),
        ),
        `uspk/${this.relay.key}/out`,
        RELAY_TIMEOUT_MS,
      );
      const message = this.parseServerMessage(reply);
      if (message?.type === "heartbeat_ack" && this.currentStatus !== "connected") {
        if (this.currentStatus !== "relay") {
          this.emit({ type: "log", message: "speaker reachable via the relay" });
        }
        this.emit({ type: "status", status: "relay" });
      }
    } catch (error) {
      if (this.currentStatus === "relay") {
        this.emit({ type: "status", status: "disconnected" });
        this.emit({ type: "log", message: `relay check failed: ${String(error)}` });
      }
    } finally {
      this.relayProbeInFlight = false;
    }
  }

  private relayTarget(): RelayTarget {
    const relay = this.relay!;
    return {
      uri: relay.uri,
      topic: `uspk/${relay.key}/in`,
      username: relay.username || undefined,
      password: relay.password || undefined,
      clientId: `phone-${this.deviceId}-${Date.now() % 100000}`,
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({
        type: "heartbeat",
        deviceId: this.deviceId,
        authToken: this.authToken,
      });
      this.heartbeatTimeoutTimer = setTimeout(() => {
        this.emit({
          type: "log",
          message: "heartbeat timed out — reconnecting",
        });
        this.socket?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
    this.heartbeatTimeoutTimer = null;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
  }

  /** Sends over the live WebSocket if connected; otherwise falls back to a
   * one-off HTTP POST to the same device. */
  /** Where to publish when the speaker is not on this phone's network. */
  setRelay(relay: RelayDetails | undefined): void {
    this.relay = relay;
  }

  async send(message: ClientMessage): Promise<void> {
    const envelope = wrapMessage(message);
    if (this.socket && this.currentStatus === "connected") {
      this.socket.send(JSON.stringify(envelope));
      return;
    }
    try {
      await this.sendViaHttp(message);
    } catch (localError) {
      // Not on the speaker's network: the shop keeps selling while the owner
      // is out with the phone, so go round by the relay rather than drop it.
      if (!this.relay) throw localError;
      await publishOverRelay(
        this.relayTarget(),
        JSON.stringify(envelope),
        RELAY_TIMEOUT_MS,
      );
      this.emit({ type: "log", message: "sent via the relay" });
    }
  }

  private async sendViaHttp(message: ClientMessage): Promise<void> {
    const url = `http://${this.ipAddress}:${this.port}/message`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrapMessage(message)),
    });
    if (!response.ok) {
      throw new Error(`HTTP fallback failed: ${response.status}`);
    }
  }
}
