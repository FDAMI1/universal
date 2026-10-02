import { parseWhoami, subnetAddresses } from "../api/discovery";

describe("subnetAddresses", () => {
  it("covers the whole /24 except the phone itself", () => {
    const hosts = subnetAddresses("192.168.0.102");
    expect(hosts).toHaveLength(253);
    expect(hosts[0]).toBe("192.168.0.1");
    expect(hosts).toContain("192.168.0.100");
    expect(hosts).not.toContain("192.168.0.102");
  });

  it("returns nothing for an address it can't make sense of", () => {
    expect(subnetAddresses("")).toEqual([]);
    expect(subnetAddresses("not.an.ip.address")).toEqual([]);
    expect(subnetAddresses("::1")).toEqual([]);
  });
});

describe("parseWhoami", () => {
  const body = {
    product: "universal-speaker",
    v: 1,
    deviceId: "SPK-1BA0A4",
    deviceName: "Universal Speaker",
    claimed: false,
    pairingOpen: true,
  };

  it("reads a speaker's reply", () => {
    expect(parseWhoami(body, "192.168.0.100")).toEqual({
      deviceId: "SPK-1BA0A4",
      deviceName: "Universal Speaker",
      ipAddress: "192.168.0.100",
      claimed: false,
      pairingOpen: true,
    });
  });

  it("ignores other devices that happen to answer on the port", () => {
    expect(parseWhoami({ product: "some-printer" }, "192.168.0.5")).toBeNull();
    expect(parseWhoami({ ...body, deviceId: "" }, "192.168.0.5")).toBeNull();
    expect(parseWhoami("<html>router login</html>", "192.168.0.1")).toBeNull();
    expect(parseWhoami(null, "192.168.0.1")).toBeNull();
  });

  it("falls back to a readable name when the speaker has none", () => {
    const { deviceName } = parseWhoami(
      { ...body, deviceName: "" },
      "192.168.0.100",
    )!;
    expect(deviceName).toBe("Universal Speaker");
  });

  it("treats a claimed speaker as claimed", () => {
    const speaker = parseWhoami(
      { ...body, claimed: true, pairingOpen: false },
      "192.168.0.100",
    )!;
    expect(speaker.claimed).toBe(true);
    expect(speaker.pairingOpen).toBe(false);
  });
});
