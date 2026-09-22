import { validatePayment } from "../paymentValidator";
import { ParsedPayment } from "../types";
import { RawNotificationEvent } from "@native/payment-notification-listener";

function makeEvent(text: string): RawNotificationEvent {
  return {
    packageName: "com.phonepe.app",
    postTimeMillis: Date.now(),
    title: "PhonePe",
    text,
    bigText: null,
    subText: null,
  };
}

function makePayment(overrides: Partial<ParsedPayment> = {}): ParsedPayment {
  return {
    amount: 50000,
    currency: "INR",
    payer: "Ravi",
    source: "phonepe_business",
    paymentType: "incoming",
    transactionId: "TXN123456",
    status: "success",
    ...overrides,
  };
}

describe("validatePayment", () => {
  it("accepts a successful incoming payment", () => {
    const result = validatePayment(
      makePayment(),
      makeEvent("You received ₹500"),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects an outgoing payment", () => {
    const result = validatePayment(
      makePayment({ paymentType: "outgoing" }),
      makeEvent("You paid ₹500"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a failed payment", () => {
    const result = validatePayment(
      makePayment({ status: "failed" }),
      makeEvent("Payment failed"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a pending payment", () => {
    const result = validatePayment(
      makePayment({ status: "pending" }),
      makeEvent("Payment pending"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a zero amount", () => {
    const result = validatePayment(
      makePayment({ amount: 0 }),
      makeEvent("₹0 received"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects an OTP notification even if it superficially matched", () => {
    const result = validatePayment(
      makePayment(),
      makeEvent("Your OTP is 500123, do not share it"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a recharge confirmation", () => {
    const result = validatePayment(
      makePayment(),
      makeEvent("Your recharge of ₹500 was successful"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a balance alert", () => {
    const result = validatePayment(
      makePayment(),
      makeEvent("Your balance is low. Minimum balance ₹500 required"),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a money request notification", () => {
    const result = validatePayment(
      makePayment(),
      makeEvent("Ravi requested ₹500 from you"),
    );
    expect(result.valid).toBe(false);
  });
});
