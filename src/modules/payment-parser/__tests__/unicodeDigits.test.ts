import {
  extractAmountPaise,
  normalizeNotificationText,
} from "../amountUtils";
import { parseGenericIncomingPayment } from "../parsers/genericPaymentParser";
import { runPaymentPipeline } from "../paymentPipeline";
import { DuplicateDetector } from "../duplicateDetector";

/**
 * Captured off a real phone over adb. PhonePe Business writes the amount with
 * mathematical double-struck digits (U+1D7D8…U+1D7E1) rather than ASCII ones,
 * which made every payment through it look like it had no amount.
 */
const PHONEPE_BUSINESS = "com.phonepe.app.business";
const REAL_TEXT =
  "You've received Rs.\u{1D7D9} from MOHAMMED ABDULLAH MOHAMMED SHARIF A";

describe("amounts written in unusual digits", () => {
  it("is the exact text the phone posted, not ASCII", () => {
    expect(REAL_TEXT).toContain("\u{1D7D9}");
    expect(REAL_TEXT).not.toContain("Rs.1");
  });

  it("reads the double-struck digits PhonePe Business uses", () => {
    expect(extractAmountPaise(REAL_TEXT)).toBe(100);
  });

  it("reads the other digit styles apps use", () => {
    // Bold, sans-serif, monospace, full-width, Devanagari, Arabic-Indic.
    expect(extractAmountPaise("Rs.\u{1D7D1}\u{1D7CF}")).toBe(3_100);
    expect(extractAmountPaise("₹\u{1D7E4}\u{1D7E2}")).toBe(2_000);
    expect(extractAmountPaise("INR \u{1D7F8}")).toBe(200);
    expect(extractAmountPaise("Rs.５００")).toBe(50_000);
    expect(extractAmountPaise("Rs.५०")).toBe(5_000);
    expect(extractAmountPaise("Rs.٧٥")).toBe(7_500);
  });

  it("still reads ordinary digits, decimals and thousands", () => {
    expect(extractAmountPaise("₹1,234.50")).toBe(123_450);
    expect(extractAmountPaise("Rs. 500")).toBe(50_000);
    expect(extractAmountPaise("INR 45")).toBe(4_500);
  });

  it("copes with a non-breaking space after the symbol", () => {
    expect(extractAmountPaise("₹ 250")).toBe(25_000);
  });

  it("leaves text without an amount alone", () => {
    expect(extractAmountPaise("Payment received")).toBeNull();
    expect(normalizeNotificationText("plain text")).toBe("plain text");
  });

  it("parses the real PhonePe Business notification", () => {
    const parsed = parseGenericIncomingPayment({
      packageName: PHONEPE_BUSINESS,
      postTimeMillis: Date.now(),
      title: "Money received",
      text: REAL_TEXT,
      bigText: REAL_TEXT,
      subText: null,
    });

    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(100);
    expect(parsed!.payer).toBe("MOHAMMED ABDULLAH MOHAMMED SHARIF A");
    expect(parsed!.paymentType).toBe("incoming");
  });

  it("announces that notification end to end", () => {
    const result = runPaymentPipeline(
      {
        packageName: PHONEPE_BUSINESS,
        postTimeMillis: Date.now(),
        title: "Money received",
        text: REAL_TEXT,
        bigText: REAL_TEXT,
        subText: null,
      },
      {
        deviceId: "SPK-1BA0A4",
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        enabledSourcePackages: new Set([PHONEPE_BUSINESS]),
        allowAnyApp: true,
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );

    expect(result.rejectedReason).toBeUndefined();
    expect(result.payment?.amount).toBe(100);
  });

  it("still refuses a debit written in the same fancy digits", () => {
    expect(
      parseGenericIncomingPayment({
        packageName: PHONEPE_BUSINESS,
        postTimeMillis: Date.now(),
        title: "Money sent",
        text: "You've paid Rs.\u{1D7D9} to SHARIF BHAI SHOP",
        bigText: null,
        subText: null,
      }),
    ).toBeNull();
  });
});
