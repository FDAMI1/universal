import { extractAmountPaise, looksLikeIncomingPayment } from "../amountUtils";

describe("extractAmountPaise", () => {
  it("parses a rupee symbol amount", () => {
    expect(extractAmountPaise("You received ₹500 from Ravi")).toBe(50000);
  });

  it("parses comma-grouped thousands", () => {
    expect(extractAmountPaise("Payment received ₹1,234.50")).toBe(123450);
  });

  it("parses an Rs. prefix", () => {
    expect(extractAmountPaise("Rs. 45 credited to your account")).toBe(4500);
  });

  it("parses an INR prefix", () => {
    expect(extractAmountPaise("INR 1000 credited")).toBe(100000);
  });

  it("returns null when no amount is present", () => {
    expect(extractAmountPaise("Your OTP is 123456")).toBeNull();
  });

  it("rounds sub-paise floating point noise away", () => {
    expect(extractAmountPaise("₹9.99")).toBe(999);
  });
});

describe("looksLikeIncomingPayment", () => {
  it("detects a receipt phrase", () => {
    expect(looksLikeIncomingPayment("You received ₹500")).toBe(true);
  });

  it("rejects an outgoing phrase", () => {
    expect(looksLikeIncomingPayment("You paid ₹500 to Ravi")).toBe(false);
  });

  it("rejects text with both signals present", () => {
    expect(
      looksLikeIncomingPayment("You paid ₹500, previously received ₹200"),
    ).toBe(false);
  });

  it("rejects neutral text", () => {
    expect(looksLikeIncomingPayment("Your balance is ₹500")).toBe(false);
  });
});
