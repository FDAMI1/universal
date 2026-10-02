/**
 * End-to-end test against a real ESP32 on the network.
 *
 * Skipped unless SPEAKER_IP is set, so `npm test` stays hardware-free:
 *   SPEAKER_IP=192.168.0.100 npx jest speakerIntegration --runInBand
 *
 * It drives the same code the app does — the notification parsers and the
 * wire protocol — so a pass means a real payment notification would be
 * announced by that speaker.
 */
import http from "node:http";
import WebSocket from "ws";
import { runPaymentPipeline } from "@modules/payment-parser/paymentPipeline";
import { DuplicateDetector } from "@modules/payment-parser/duplicateDetector";
import { parseWhoami } from "@modules/pairing/api/discovery";
import {
  wrapMessage,
  type ClientMessage,
  type ServerMessage,
  DEFAULT_ESP32_PORT,
} from "../protocol";
import type { PaymentObject } from "@shared/types/payment";

jest.setTimeout(60_000);

const SPEAKER_IP = process.env.SPEAKER_IP;
const describeHardware = SPEAKER_IP ? describe : describe.skip;

const AUTH_TOKEN = "e2e".padEnd(64, "0");
const REPLY_TIMEOUT_MS = 10_000;
/** Announcements play one after another from an 8-deep queue, and a burst
 * sent faster than the speaker can talk is refused on purpose. Wait for it to
 * stop talking rather than guessing at a duration. */
const SPEECH_TIMEOUT_MS = 20_000;

async function waitForSpeech(): Promise<void> {
  const deadline = Date.now() + SPEECH_TIMEOUT_MS;
  for (;;) {
    const status = (await getJson("/whoami")) as { speaking?: boolean };
    if (!status.speaking || Date.now() > deadline) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/** Node's http client, not fetch: expo's fetch polyfill doesn't run under
 * jest. The app itself uses React Native's fetch, which is exercised on the
 * device, not here. */
function getJson(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http
      .get(
        { host: SPEAKER_IP, port: DEFAULT_ESP32_PORT, path, timeout: 5_000 },
        (response) => {
          let body = "";
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
          });
        },
      )
      .on("error", reject);
  });
}

/** Opens a socket, sends one message, resolves with the speaker's reply. */
function ask(message: ClientMessage): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${SPEAKER_IP}:${DEFAULT_ESP32_PORT}/`);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`no reply to ${message.type}`));
    }, REPLY_TIMEOUT_MS);

    socket.on("open", () => socket.send(JSON.stringify(wrapMessage(message))));
    socket.on("message", (data) => {
      clearTimeout(timer);
      socket.close();
      resolve(JSON.parse(data.toString()).message as ServerMessage);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/** Messages the speaker acknowledges with audio only (no reply frame). */
function tell(message: ClientMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://${SPEAKER_IP}:${DEFAULT_ESP32_PORT}/`);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`could not send ${message.type}`));
    }, REPLY_TIMEOUT_MS);
    socket.on("open", () => {
      socket.send(JSON.stringify(wrapMessage(message)));
      setTimeout(() => {
        clearTimeout(timer);
        socket.close();
        resolve();
      }, 500);
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describeHardware("speaker integration", () => {
  let deviceId = "";
  /** A speaker a real phone owns is left alone: claiming it here would kick
   * that phone off. Those tests report as skipped instead. */
  let ownedByAPhone = false;

  beforeAll(async () => {
    // A previous run may still be mid-announcement; start from silence.
    await waitForSpeech();
    const status = (await getJson("/whoami")) as {
      claimed?: boolean;
      pairingOpen?: boolean;
    };
    ownedByAPhone = status.claimed === true && status.pairingOpen !== true;
    if (ownedByAPhone) {
      console.warn(
        "Speaker is paired with a phone — skipping the tests that need to " +
          "claim it. Release it in the app, or press BOOT, to run them all.",
      );
    }
  });

  /** Returns true when the test body should be skipped. */
  const needsClaim = () => ownedByAPhone;

  it("is discoverable by the same sweep the app runs", async () => {
    const speaker = parseWhoami(await getJson("/whoami"), SPEAKER_IP!);
    expect(speaker).not.toBeNull();
    expect(speaker!.deviceId).toMatch(/^SPK-/);
    deviceId = speaker!.deviceId;
  });

  it("claims an unowned speaker without a PIN", async () => {
    if (needsClaim()) return;
    const reply = await ask({
      type: "pair",
      deviceId,
      authToken: AUTH_TOKEN,
      pin: "",
    });
    expect(reply.type).toBe("pair_ack");
  });

  it("reports itself as claimed once paired", async () => {
    if (needsClaim()) return;
    const speaker = parseWhoami(await getJson("/whoami"), SPEAKER_IP!);
    expect(speaker!.claimed).toBe(true);
  });

  it("rejects a phone without the token", async () => {
    const reply = await ask({
      type: "heartbeat",
      deviceId,
      authToken: "wrong-token",
    });
    expect(reply.type).toBe("error");
  });

  it("answers heartbeats from the paired phone", async () => {
    if (needsClaim()) return;
    const reply = await ask({
      type: "heartbeat",
      deviceId,
      authToken: AUTH_TOKEN,
    });
    expect(reply.type).toBe("heartbeat_ack");
  });

  it("accepts the volume the app sends", async () => {
    if (needsClaim()) return;
    const reply = await ask({
      type: "set_volume",
      deviceId,
      authToken: AUTH_TOKEN,
      volume: 80,
    });
    expect(reply.type).toBe("volume_ack");
  });

  it("plays the test announcement", async () => {
    if (needsClaim()) return;
    await tell({ type: "test_speaker", deviceId, authToken: AUTH_TOKEN });
    await waitForSpeech();
  });

  it("announces a real PhonePe Business notification", async () => {
    if (needsClaim()) return;
    // Exactly what the Android listener hands the pipeline.
    const pipeline = runPaymentPipeline(
      {
        packageName: "com.phonepe.app",
        postTimeMillis: Date.now(),
        title: "Payment received",
        text: "₹500 received from RAHUL SHARMA",
        bigText: "₹500 received from RAHUL SHARMA. UPI Ref: 123456789012",
        subText: null,
      },
      {
        deviceId,
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        enabledSourcePackages: new Set(["com.phonepe.app"]),
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );

    const payment = pipeline.payment as PaymentObject;
    expect(pipeline.rejectedReason).toBeUndefined();
    expect(payment.amount).toBe(50_000); // ₹500 in paise
    expect(payment.source).toBe("phonepe_business");

    const reply = await ask({
      type: "payment",
      deviceId,
      authToken: AUTH_TOKEN,
      payment,
    });
    expect(reply.type).toBe("payment_ack");
    await waitForSpeech();
  });

  it("announces a Google Pay payment with paise", async () => {
    if (needsClaim()) return;
    const pipeline = runPaymentPipeline(
      {
        packageName: "com.google.android.apps.nbu.paisa.user",
        postTimeMillis: Date.now(),
        title: "You received ₹1,250.50",
        text: "You received ₹1,250.50 from Priya",
        bigText: null,
        subText: null,
      },
      {
        deviceId,
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        enabledSourcePackages: new Set([
          "com.google.android.apps.nbu.paisa.user",
        ]),
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );

    const payment = pipeline.payment as PaymentObject;
    expect(payment).not.toBeNull();
    expect(payment.amount).toBe(125_050);

    const reply = await ask({
      type: "payment",
      deviceId,
      authToken: AUTH_TOKEN,
      payment,
    });
    expect(reply.type).toBe("payment_ack");
    await waitForSpeech();
  });

  it("announces a bank SMS credit, the way a savings-account payment arrives", async () => {
    if (needsClaim()) return;
    const pipeline = runPaymentPipeline(
      {
        packageName: "com.google.android.apps.messaging",
        postTimeMillis: Date.now(),
        title: "JK-KOTAKD-S",
        text: "Received Rs.1.00 from FARHAN AHMAD on 02-10-26. UPI Ref 532112345678 -Kotak Bank",
        bigText: null,
        subText: null,
      },
      {
        deviceId,
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        smsPackageName: "com.google.android.apps.messaging",
        enabledSourcePackages: new Set(["com.google.android.apps.messaging"]),
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );

    const payment = pipeline.payment as PaymentObject;
    expect(pipeline.rejectedReason).toBeUndefined();
    expect(payment.amount).toBe(100);

    const reply = await ask({
      type: "payment",
      deviceId,
      authToken: AUTH_TOKEN,
      payment,
    });
    expect(reply.type).toBe("payment_ack");
    await waitForSpeech();
  });

  it("releases the speaker again so a phone can claim it", async () => {
    if (needsClaim()) return;
    const reply = await ask({
      type: "unpair",
      deviceId,
      authToken: AUTH_TOKEN,
    });
    expect(reply.type).toBe("unpair_ack");

    const speaker = parseWhoami(await getJson("/whoami"), SPEAKER_IP!);
    expect(speaker!.claimed).toBe(false);
  });
});
