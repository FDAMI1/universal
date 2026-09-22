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

  it("does not flag a different source", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment({ source: "phonepe_business" }), 1_000);
    expect(
      detector.isDuplicate(makePayment({ source: "paytm_business" }), 5_000),
    ).toBe(false);
  });

  it("respects a window updated via setWindowMs", () => {
    const detector = new DuplicateDetector(30_000);
    detector.isDuplicate(makePayment(), 1_000);
    detector.setWindowMs(2_000);
    expect(detector.isDuplicate(makePayment(), 5_000)).toBe(false);
  });
});
