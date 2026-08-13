import { PaymentObject } from "@shared/types/payment";

/**
 * Wire protocol between the phone app and the ESP32 sound box (PDR Module 7:
 * Communication Layer). WebSocket is primary; HTTP POST is the fallback for
 * the same message shapes when a persistent socket can't be established.
 * Keep this file as the single source of truth for both sides — the ESP32
 * firmware (Phase 8) implements the same envelope in C++.
 */
export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { type: "pair"; deviceId: string; authToken: string; pin: string }
  | { type: "payment"; deviceId: string; authToken: string; payment: PaymentObject }
  | { type: "test_speaker"; deviceId: string; authToken: string }
  | { type: "heartbeat"; deviceId: string; authToken: string };

export type ServerMessage =
  | { type: "pair_ack"; deviceId: string; deviceName: string }
  | { type: "pair_reject"; reason: string }
  | { type: "payment_ack"; deviceId: string }
  | { type: "heartbeat_ack"; deviceId: string }
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

export const DEFAULT_ESP32_PORT = 8080;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TIMEOUT_MS = 5_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
