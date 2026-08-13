import { phonePeBusinessParser } from "../parsers/phonePeBusinessParser";
import { paytmBusinessParser } from "../parsers/paytmBusinessParser";
import { googlePayParser } from "../parsers/googlePayParser";
import { bankSmsParser } from "../parsers/bankSmsParser";
import { RawNotificationEvent } from "@native/payment-notification-listener";

// NOTE: the notification text below is CONSTRUCTED to match this project's
// best guess at each app's wording (see the UNVERIFIED comments in each
// parser file), not captured from a real device. These tests lock in
// today's expected behavior for that guessed wording — once real samples
// are captured via the Logs screen, update both the parser regex and these
// fixtures together.

function event(overrides: Partial<RawNotificationEvent>): RawNotificationEvent {
  return {
    packageName: "com.example.app",
    postTimeMillis: Date.now(),
    title: null,
    text: null,
    bigText: null,
    subText: null,
    ...overrides,
  };
}

describe("phonePeBusinessParser", () => {
  it("parses a received-payment notification", () => {
    const result = phonePeBusinessParser.parse(
      event({
        packageName: "com.phonepe.app",
        title: "PhonePe Business",
        text: "You received ₹500 from Ravi Kumar. UTR: 123456789012",
      }),
    );
    expect(result).toMatchObject({
      amount: 50000,
      payer: "Ravi Kumar",
      source: "phonepe_business",
      paymentType: "incoming",
      status: "success",
    });
  });

  it("returns null for an outgoing payment", () => {
    const result = phonePeBusinessParser.parse(
      event({
        packageName: "com.phonepe.app",
        text: "You paid ₹500 to Ravi Kumar",
      }),
    );
    expect(result).toBeNull();
  });

  it("returns null when there's no amount", () => {
    const result = phonePeBusinessParser.parse(
      event({ packageName: "com.phonepe.app", text: "Your KYC is complete" }),
    );
    expect(result).toBeNull();
  });
});

describe("paytmBusinessParser", () => {
  it("parses a received-payment notification", () => {
    const result = paytmBusinessParser.parse(
      event({
        packageName: "net.one97.paytm",
        text: "Payment received ₹250 from Suresh. Order ID: ABC12345",
      }),
    );
    expect(result).toMatchObject({
      amount: 25000,
      source: "paytm_business",
      paymentType: "incoming",
      status: "success",
    });
  });
});

describe("googlePayParser", () => {
  it("parses a 'paid you' notification", () => {
    const result = googlePayParser.parse(
      event({
        packageName: "com.google.android.apps.nbu.paisa.user",
        text: "Priya paid you ₹100",
      }),
    );
    expect(result).toMatchObject({
      amount: 10000,
      payer: "Priya",
      source: "google_pay",
      paymentType: "incoming",
    });
  });
});

describe("bankSmsParser", () => {
  it("parses a credit alert", () => {
    const result = bankSmsParser.parse(
      event({
        packageName: "com.google.android.apps.messaging",
        text: "Rs.500.00 credited to A/c XX1234 on 01-Jan-25. Ref No 987654321",
      }),
    );
    expect(result).toMatchObject({
      amount: 50000,
      source: "bank_sms",
      paymentType: "incoming",
      status: "success",
    });
  });

  it("returns null for a debit alert", () => {
    const result = bankSmsParser.parse(
      event({
        packageName: "com.google.android.apps.messaging",
        text: "Rs.500.00 debited from A/c XX1234 on 01-Jan-25",
      }),
    );
    expect(result).toBeNull();
  });
});
