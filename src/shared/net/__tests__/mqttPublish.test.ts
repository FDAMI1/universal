import {
  buildConnect,
  buildPublish,
  encodeLength,
  isPuback,
  readConnack,
  MqttPublishError,
} from "../mqttPublish";

/** Packets are compared as bytes, because a broker will reject a wrong one. */
const bytes = (packet: Uint8Array) => Array.from(packet);

describe("MQTT remaining length", () => {
  it("matches the values in the specification", () => {
    expect(encodeLength(0)).toEqual([0x00]);
    expect(encodeLength(127)).toEqual([0x7f]);
    expect(encodeLength(128)).toEqual([0x80, 0x01]);
    expect(encodeLength(16_383)).toEqual([0xff, 0x7f]);
    expect(encodeLength(16_384)).toEqual([0x80, 0x80, 0x01]);
  });
});

describe("CONNECT", () => {
  it("announces MQTT 3.1.1 with a clean session", () => {
    const packet = bytes(buildConnect("spk-phone"));
    expect(packet[0]).toBe(0x10);
    // "MQTT", level 4, flags, keepalive
    expect(packet.slice(2, 8)).toEqual([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54]);
    expect(packet[8]).toBe(0x04);
    expect(packet[9]).toBe(0x02); // clean session, no credentials
    expect(packet.slice(10, 12)).toEqual([0x00, 30]);
  });

  it("sets the credential flags when a username and password are given", () => {
    const packet = bytes(buildConnect("spk-phone", "shop", "secret"));
    expect(packet[9]).toBe(0x02 | 0x80 | 0x40);
  });

  it("carries the client name as a length-prefixed string", () => {
    const packet = bytes(buildConnect("abc"));
    expect(packet.slice(12)).toEqual([0x00, 0x03, 0x61, 0x62, 0x63]);
  });
});

describe("PUBLISH", () => {
  it("uses QoS 1 so the broker has to acknowledge", () => {
    const packet = bytes(buildPublish("uspk/key/in", "{}", 1));
    expect(packet[0]).toBe(0x32);
  });

  it("puts the topic, packet id and payload in that order", () => {
    const packet = bytes(buildPublish("ab", "hi", 7));
    expect(packet.slice(2)).toEqual([
      0x00, 0x02, 0x61, 0x62, // topic "ab"
      0x00, 0x07, // packet id
      0x68, 0x69, // payload "hi", with no length prefix
    ]);
  });

  it("encodes a rupee sign as UTF-8", () => {
    const packet = bytes(buildPublish("t", "₹", 1));
    expect(packet.slice(packet.length - 3)).toEqual([0xe2, 0x82, 0xb9]);
  });

  it("grows the length field for a payload over 127 bytes", () => {
    const packet = buildPublish("t", "x".repeat(200), 1);
    expect(packet[1] & 0x80).toBe(0x80); // continuation bit set
  });
});

describe("CONNACK", () => {
  it("accepts a successful connection", () => {
    expect(() => readConnack(Uint8Array.from([0x20, 0x02, 0x00, 0x00]))).not.toThrow();
  });

  it("explains a rejected password in words the user can act on", () => {
    expect(() => readConnack(Uint8Array.from([0x20, 0x02, 0x00, 0x04]))).toThrow(
      /relay username or password/,
    );
  });

  it("rejects a reply that isn't a CONNACK at all", () => {
    expect(() => readConnack(Uint8Array.from([0x30, 0x02, 0x00, 0x00]))).toThrow(
      MqttPublishError,
    );
  });
});

describe("PUBACK", () => {
  it("recognises the broker taking responsibility", () => {
    expect(isPuback(Uint8Array.from([0x40, 0x02, 0x00, 0x01]))).toBe(true);
  });

  it("is not fooled by other packets", () => {
    expect(isPuback(Uint8Array.from([0x20, 0x02, 0x00, 0x00]))).toBe(false);
    expect(isPuback(Uint8Array.from([0x40]))).toBe(false);
  });
});
