import {
  PortalUnreachableError,
  scanNetworks,
  requestWifiConnect,
} from "../api/setupPortalApi";

describe("setupPortalApi", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  function respondWith(body: unknown, ok = true) {
    mockFetch.mockResolvedValue({ ok, json: async () => body });
  }

  it("drops non-string and empty entries from a scan", async () => {
    respondWith(["Home", "", 42, "Hotspot", null]);
    await expect(scanNetworks()).resolves.toEqual(["Home", "Hotspot"]);
  });

  it("returns an empty list when the portal sends something unexpected", async () => {
    respondWith({ oops: true });
    await expect(scanNetworks()).resolves.toEqual([]);
  });

  it("reports an unreachable portal rather than a raw network error", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(scanNetworks()).rejects.toBeInstanceOf(PortalUnreachableError);
  });

  it("treats an HTTP error status as unreachable", async () => {
    respondWith("", false);
    await expect(scanNetworks()).rejects.toBeInstanceOf(PortalUnreachableError);
  });

  it("form-encodes credentials, so passwords with symbols survive", async () => {
    respondWith("");
    await requestWifiConnect("My Net", "p&ss=wo rd");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://192.168.4.1/connect");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("ssid=My+Net&password=p%26ss%3Dwo+rd");
  });
});
