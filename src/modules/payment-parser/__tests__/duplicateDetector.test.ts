import { DuplicateDetector } from "../duplicateDetector";
import { ParsedPayment } from "../types";

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

describe("DuplicateDetector", () => {
  it("does not flag the first sighting of a payment", () => {
    const detector = new DuplicateDetector(30_000);
    expect(detector.isDuplicate(makePayment(), 1_000)).toBe(false);
  });

  it("flags a repeat with the same transaction ID within the window", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment(), 1_000);
    expect(detector.isDuplicate(makePayment(), 5_000)).toBe(true);
  });

  it("flags a repeat with matching amount+source but no transaction ID either side", () => {
    const detector = new DuplicateDetector(30_000);
    const noTxn = makePayment({ transactionId: null });
    detector.isDuplicate(noTxn, 1_000);
    expect(detector.isDuplicate(noTxn, 5_000)).toBe(true);
  });

  it("does not flag a different transaction ID even with matching amount+source", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment({ transactionId: "AAA" }), 1_000);
    expect(
      detector.isDuplicate(makePayment({ transactionId: "BBB" }), 5_000),
    ).toBe(false);
  });

  it("does not flag once the window has expired", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment(), 1_000);
    expect(detector.isDuplicate(makePayment(), 40_000)).toBe(false);
  });

  it("does not flag a different amount", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment({ amount: 50000 }), 1_000);
    expect(detector.isDuplicate(makePayment({ amount: 60000 }), 5_000)).toBe(
      false,
    );
  });

  // One sale is routinely reported twice: by the payment app, then again by
  // the bank's SMS. The shop should hear it once.
  it("flags the same amount reported by a second source", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(
      makePayment({ source: "other_app", transactionId: null }),
      1_000,
    );
    expect(
      detector.isDuplicate(
        makePayment({ source: "bank_sms", transactionId: null }),
        5_000,
      ),
    ).toBe(true);
  });

  it("still lets two genuinely separate payments through", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(
      makePayment({ source: "other_app", transactionId: "AAA111" }),
      1_000,
    );
    expect(
      detector.isDuplicate(
        makePayment({ source: "bank_sms", transactionId: "BBB222" }),
        5_000,
      ),
    ).toBe(false);
  });

  it("respects a window updated via setWindowMs", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment(), 1_000);
    detector.setWindowMs(2_000);
    expect(detector.isDuplicate(makePayment(), 5_000)).toBe(false);
  });
});

// A shop takes two ₹5 sales a few seconds apart: both must be announced.
// A single sale reported by the app and again by the bank must not be.
describe("two customers paying the same amount", () => {
  const at = (payer: string | null, transactionId: string | null = null) =>
    makePayment({ amount: 500, payer, transactionId });

  it("announces both when the payers differ", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(at("RAHUL SHARMA"), 1_000);
    expect(detector.isDuplicate(at("PRIYA VERMA"), 6_000)).toBe(false);
  });

  it("suppresses the same payer reported twice", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(at("RAHUL SHARMA"), 1_000);
    expect(detector.isDuplicate(at("rahul  sharma"), 4_000)).toBe(true);
  });

  it("treats a truncated name as the same payer", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(at("MOHAMMED ABDULLAH SHARIF A"), 1_000);
    expect(detector.isDuplicate(at("MOHAMMED ABDULLAH"), 3_000)).toBe(true);
  });

  it("falls back to amount alone when no payer is known", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(at(null), 1_000);
    expect(detector.isDuplicate(at(null), 4_000)).toBe(true);
  });

  it("lets a repeat through once the window has passed", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(at("RAHUL SHARMA"), 1_000);
    expect(detector.isDuplicate(at("RAHUL SHARMA"), 40_000)).toBe(false);
  });
});
