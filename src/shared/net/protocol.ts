import { PaymentObject } from "@shared/types/payment";

/**
 * Wire protocol between the phone app and the ESP32 sound box (PDR Module 7:
 * Communication Layer). WebSocket is primary; HTTP POST is the fallback for
 * the same message shapes when a persistent socket can't be established.
 * Keep this file as the single source of truth for both sides — the ESP32
 * firmware (Phase 8) implements the same envelope in C++.
 */
export const PROTOCOL_VERSION = 1;

/** Where to publish for a speaker that isn't on this phone's network. The
 * topic is a per-speaker secret, handed over only when pairing succeeds. */
export interface RelayDetails {
  /** wss://host:port/mqtt */
  uri: string;
  /** mqtts://host:port, for the native side */
  mqttUri?: string;
  key: string;
  username?: string;
  password?: string;
}

export type ClientMessage =
  | { type: "pair"; deviceId: string; authToken: string; pin: string }
  | {
      type: "payment";
      deviceId: string;
      authToken: string;
      payment: PaymentObject;
    }
  | { type: "test_speaker"; deviceId: string; authToken: string }
  // Releases the speaker so another phone can claim it. The speaker
  // forgets this phone's token and reopens pairing.
  | { type: "unpair"; deviceId: string; authToken: string }
  | { type: "get_relay"; deviceId: string; authToken: string }
  | {
      type: "set_relay";
      deviceId: string;
      authToken: string;
      uri: string;
      wsUri: string;
      username: string;
      password: string;
    }
  // volume is 0-100; the speaker stores it and keeps it across reboots.
  | {
      type: "set_volume";
      deviceId: string;
      authToken: string;
      volume: number;
    }
  | { type: "heartbeat"; deviceId: string; authToken: string };

export type ServerMessage =
  | {
      type: "pair_ack";
      deviceId: string;
      deviceName: string;
      /** Present when the speaker can be reached over the internet too. */
      relay?: RelayDetails;
    }
  | { type: "pair_reject"; reason: string }
  | { type: "payment_ack"; deviceId: string }
  | { type: "heartbeat_ack"; deviceId: string }
  | { type: "volume_ack"; deviceId: string }
  | { type: "unpair_ack"; deviceId: string }
  | {
      type: "relay_ack";
      deviceId: string;
      key: string;
      uri?: string;
      mqttUri?: string;
      username?: string;
      password?: string;
    }
  | { type: "error"; message: string };

export interface WireEnvelope<T> {
  v: number; // PROTOCOL_VERSION
  message: T;
}

export function wrapMessage<T>(message: T): WireEnvelope<T> {
  return { v: PROTOCOL_VERSION, message };
}

export function isCompatibleVersion(v: number): boolean {
  return v === PROTOCOL_VERSION;
}

/** Relaying is a fallback, so it waits longer than the local path before
 * giving up: it is a round trip over the internet, not across the room. */
export const RELAY_TIMEOUT_MS = 10_000;

export const DEFAULT_ESP32_PORT = 8080;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TIMEOUT_MS = 5_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
