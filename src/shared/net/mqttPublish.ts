/**
 * Publishes one MQTT message over a WebSocket, then closes.
 *
 * Written by hand rather than pulling in mqtt.js, which expects Node's `net`
 * and `tls` and needs polyfills that break on network changes in React
 * Native. The phone only ever publishes — it never subscribes, keeps no
 * session and needs no QoS beyond "the broker said it got it" — so the whole
 * client is CONNECT, PUBLISH, DISCONNECT, which is small enough to own.
 *
 * MQTT 3.1.1, as described in the OASIS spec (sections 3.1, 3.3, 3.14).
 */

const PROTOCOL_NAME = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]; // "MQTT"
const PROTOCOL_LEVEL = 0x04; // 3.1.1
const CONNECT = 0x10;
const CONNACK = 0x20;
const PUBLISH = 0x30;
const PUBACK = 0x40;
const DISCONNECT = 0xe0;
const KEEPALIVE_SECONDS = 30;

export class MqttPublishError extends Error {}

/** Remaining Length: 7 bits per byte, high bit marks "more to come". */
export function encodeLength(value: number): number[] {
  const out: number[] = [];
  let remaining = value;
  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    out.push(byte);
  } while (remaining > 0);
  return out;
}

/** UTF-8, length-prefixed with two bytes, as every MQTT string is. */
function encodeString(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return [(bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
}

export function buildConnect(
  clientId: string,
  username?: string,
  password?: string,
): Uint8Array {
  let flags = 0x02; // clean session
  if (username) flags |= 0x80;
  if (password) flags |= 0x40;

  const payload = [
    ...encodeString(clientId),
    ...(username ? encodeString(username) : []),
    ...(password ? encodeString(password) : []),
  ];
  const variableHeader = [
    ...PROTOCOL_NAME,
    PROTOCOL_LEVEL,
    flags,
    (KEEPALIVE_SECONDS >> 8) & 0xff,
    KEEPALIVE_SECONDS & 0xff,
  ];
  const body = [...variableHeader, ...payload];
  return Uint8Array.from([CONNECT, ...encodeLength(body.length), ...body]);
}

/** QoS 1, so the broker acknowledges and a dropped message is detectable. */
export function buildPublish(
  topic: string,
  payload: string,
  packetId: number,
): Uint8Array {
  const body = [
    ...encodeString(topic),
    (packetId >> 8) & 0xff,
    packetId & 0xff,
    ...encodeString(payload).slice(2), // the payload carries no length prefix
  ];
  return Uint8Array.from([PUBLISH | 0x02, ...encodeLength(body.length), ...body]);
}

const CONNACK_ERRORS: Record<number, string> = {
  1: "the broker refused this protocol version",
  2: "the broker rejected the client name",
  3: "the broker is unavailable",
  4: "wrong relay username or password",
  5: "this speaker's relay account is not authorised",
};

export function readConnack(packet: Uint8Array): void {
  if (packet.length < 4 || (packet[0] & 0xf0) !== CONNACK) {
    throw new MqttPublishError("the broker sent an unexpected reply");
  }
  const code = packet[3];
  if (code !== 0) {
    throw new MqttPublishError(
      CONNACK_ERRORS[code] ?? `the broker refused the connection (${code})`,
    );
  }
}

export function isPuback(packet: Uint8Array): boolean {
  return packet.length >= 4 && (packet[0] & 0xf0) === PUBACK;
}

export interface RelayTarget {
  /** wss://host:port/mqtt */
  uri: string;
  topic: string;
  username?: string;
  password?: string;
  clientId: string;
}

/**
 * Connects, publishes, waits for the broker's acknowledgement, disconnects.
 * Resolves only once the broker has taken responsibility for the message.
 */
export function publishOverRelay(
  target: RelayTarget,
  payload: string,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(target.uri, ["mqtt"]);
    } catch (error) {
      reject(new MqttPublishError(String(error)));
      return;
    }
    socket.binaryType = "arraybuffer";

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // Already closing; the result is decided either way.
      }
      error ? reject(error) : resolve();
    };

    const timer = setTimeout(
      () => finish(new MqttPublishError("the relay did not respond in time")),
      timeoutMs,
    );

    socket.onopen = () => {
      socket.send(
        buildConnect(target.clientId, target.username, target.password),
      );
    };

    socket.onmessage = (event) => {
      const packet = new Uint8Array(event.data as ArrayBuffer);
      try {
        if ((packet[0] & 0xf0) === CONNACK) {
          readConnack(packet);
          socket.send(buildPublish(target.topic, payload, 1));
          return;
        }
        if (isPuback(packet)) {
          socket.send(Uint8Array.from([DISCONNECT, 0x00]));
          finish();
        }
      } catch (error) {
        finish(error instanceof Error ? error : new MqttPublishError(String(error)));
      }
    };

    socket.onerror = () =>
      finish(new MqttPublishError("could not reach the relay"));
    socket.onclose = () =>
      finish(new MqttPublishError("the relay closed the connection"));
  });
}
