import {
  wrapMessage,
  isCompatibleVersion,
  PROTOCOL_VERSION,
} from "../protocol";

describe("wrapMessage", () => {
  it("wraps a message with the current protocol version", () => {
    const message = {
      type: "heartbeat" as const,
      deviceId: "d1",
      authToken: "t1",
    };
    expect(wrapMessage(message)).toEqual({ v: PROTOCOL_VERSION, message });
  });
});

describe("isCompatibleVersion", () => {
  it("accepts the current version", () => {
    expect(isCompatibleVersion(PROTOCOL_VERSION)).toBe(true);
  });

  it("rejects a different version", () => {
    expect(isCompatibleVersion(PROTOCOL_VERSION + 1)).toBe(false);
    expect(isCompatibleVersion(0)).toBe(false);
  });
});
