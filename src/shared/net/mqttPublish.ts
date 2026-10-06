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

const SUBSCRIBE = 0x80;
const SUBACK = 0x90;

/** QoS 1 subscription, so the reply is not silently dropped on the way. */
export function buildSubscribe(topic: string, packetId: number): Uint8Array {
  const body = [
    (packetId >> 8) & 0xff,
    packetId & 0xff,
    ...encodeString(topic),
    0x01, // requested QoS
  ];
  return Uint8Array.from([SUBSCRIBE | 0x02, ...encodeLength(body.length), ...body]);
}

export function isSuback(packet: Uint8Array): boolean {
  return packet.length >= 5 && (packet[0] & 0xf0) === SUBACK;
}

/** Decodes a PUBLISH the broker sends us. Null for any other packet. */
export function parsePublish(
  packet: Uint8Array,
): { topic: string; payload: string; packetId: number | null } | null {
  if (packet.length < 2 || (packet[0] & 0xf0) !== PUBLISH) return null;
  const qos = (packet[0] >> 1) & 0x03;

  // Walk past the variable-length Remaining Length field.
  let index = 1;
  let multiplier = 1;
  let remaining = 0;
  for (;;) {
    const digit = packet[index++];
    remaining += (digit & 0x7f) * multiplier;
    if ((digit & 0x80) === 0) break;
    multiplier *= 128;
    if (index > 4) return null;
  }

  const topicLength = (packet[index] << 8) | packet[index + 1];
  index += 2;
  const topic = utf8Decode(packet.subarray(index, index + topicLength));
  index += topicLength;

  let packetId: number | null = null;
  if (qos > 0) {
    packetId = (packet[index] << 8) | packet[index + 1];
    index += 2;
  }
  return { topic, payload: utf8Decode(packet.subarray(index)), packetId };
}

function utf8Decode(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if (b0 < 0xe0) {
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b0 < 0xf0) {
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    } else {
      const code =
        ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(code);
      i += 4;
    }
  }
  return out;
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

/**
 * Publishes a request and waits for the speaker's reply on `replyTopic`.
 * This is how the app finds out whether the speaker is actually reachable
 * through the relay, as opposed to the broker merely accepting the message.
 */
export function requestOverRelay(
  target: RelayTarget,
  payload: string,
  replyTopic: string,
  timeoutMs = 10_000,
): Promise<string> {
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
    const finish = (error?: Error, reply?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.send(Uint8Array.from([DISCONNECT, 0x00]));
        socket.close();
      } catch {
        // Already closing; the result is decided either way.
      }
      error ? reject(error) : resolve(reply ?? "");
    };

    const timer = setTimeout(
      () => finish(new MqttPublishError("the speaker did not answer over the relay")),
      timeoutMs,
    );

    socket.onopen = () => {
      socket.send(buildConnect(target.clientId, target.username, target.password));
    };

    socket.onmessage = (event) => {
      const packet = new Uint8Array(event.data as ArrayBuffer);
      try {
        if ((packet[0] & 0xf0) === CONNACK) {
          readConnack(packet);
          socket.send(buildSubscribe(replyTopic, 1));
          return;
        }
        if (isSuback(packet)) {
          socket.send(buildPublish(target.topic, payload, 2));
          return;
        }
        const incoming = parsePublish(packet);
        if (incoming && incoming.topic === replyTopic) {
          if (incoming.packetId !== null) {
            socket.send(
              Uint8Array.from([PUBACK, 0x02, incoming.packetId >> 8, incoming.packetId & 0xff]),
            );
          }
          finish(undefined, incoming.payload);
        }
        // PUBACK for our own publish needs no action.
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
