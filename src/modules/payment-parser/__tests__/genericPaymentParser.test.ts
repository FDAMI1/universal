import { parseGenericIncomingPayment } from "../parsers/genericPaymentParser";
import { runPaymentPipeline } from "../paymentPipeline";
import { DuplicateDetector } from "../duplicateDetector";

const notification = (
  packageName: string,
  title: string,
  text: string | null = null,
) => ({
  packageName,
  postTimeMillis: Date.now(),
  title,
  text,
  bigText: null,
  subText: null,
});

/** Google Pay for Business — the app that took the ₹1 sale that was missed. */
const GPAY_BUSINESS = "com.google.android.apps.nbu.paisa.merchant";

describe("payments from any app", () => {
  it("reads a Google Pay for Business sale", () => {
    const parsed = parseGenericIncomingPayment(
      notification(
        GPAY_BUSINESS,
        "Payment received",
        "You received ₹1 from MOHAMMED ABDULLAH. UPI txn ID 627848040025",
      ),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(100);
    expect(parsed!.payer).toBe("MOHAMMED ABDULLAH");
    expect(parsed!.transactionId).toBe("627848040025");
    expect(parsed!.source).toBe("other_app");
  });

  it("reads the shapes other merchant apps use", () => {
    const cases: [string, number][] = [
      ["₹1 received in your account", 100],
      ["You have received Rs.250.50 from RAHUL", 25_050],
      ["Payment received of INR 1,500", 150_000],
      ["Amit has paid you ₹75", 7_500],
      ["₹2,000 credited to your account", 200_000],
    ];
    for (const [text, paise] of cases) {
      const parsed = parseGenericIncomingPayment(
        notification("com.some.new.upi.app", text),
      );
      expect(parsed?.amount).toBe(paise);
    }
  });

  it("never announces money going out", () => {
    const outgoing = [
      "You paid ₹500 to SHELL PETROL",
      "₹120 debited from your account",
      "Rs.99 sent to Ramesh",
      "You have spent ₹250 on your card",
      "Transferred ₹1,000 to savings",
    ];
    for (const text of outgoing) {
      expect(
        parseGenericIncomingPayment(notification("com.any.app", text)),
      ).toBeNull();
    }
  });

  it("ignores requests for money, which are not sales", () => {
    expect(
      parseGenericIncomingPayment(
        notification("com.phonepe.app", "RAHUL is requesting ₹500"),
      ),
    ).toBeNull();
    expect(
      parseGenericIncomingPayment(
        notification("com.any.app", "Payment of ₹300 is due. Pay now"),
      ),
    ).toBeNull();
  });

  it("ignores marketing that borrows payment words", () => {
    const promos = [
      "You received 500 reward points!",
      "Congratulations! Get ₹100 cashback on your next order",
      "You won a scratch card worth ₹50",
      "Flat ₹200 off — shop now",
      "Get a loan of ₹50,000 instantly",
    ];
    for (const text of promos) {
      expect(
        parseGenericIncomingPayment(notification("com.any.app", text)),
      ).toBeNull();
    }
  });

  it("ignores chat and system apps outright", () => {
    expect(
      parseGenericIncomingPayment(
        notification("com.whatsapp", "Rahul: I received ₹500 from him"),
      ),
    ).toBeNull();
  });

  it("ignores anything without an amount", () => {
    expect(
      parseGenericIncomingPayment(
        notification("com.any.app", "Payment received successfully"),
      ),
    ).toBeNull();
  });

  it("would have announced the missed sale, end to end", () => {
    const result = runPaymentPipeline(
      notification(
        GPAY_BUSINESS,
        "Payment received",
        "You received ₹1 from MOHAMMED ABDULLAH",
      ),
      {
        deviceId: "SPK-1BA0A4",
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        // The package isn't in any enabled list — that is the whole point.
        enabledSourcePackages: new Set(["com.phonepe.app"]),
        allowAnyApp: true,
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );
    expect(result.rejectedReason).toBeUndefined();
    expect(result.payment?.amount).toBe(100);
  });

  it("still refuses unknown apps when any-app is switched off", () => {
    const result = runPaymentPipeline(
      notification(GPAY_BUSINESS, "You received ₹1 from SOMEONE"),
      {
        deviceId: "SPK-1BA0A4",
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        enabledSourcePackages: new Set(["com.phonepe.app"]),
        allowAnyApp: false,
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );
    expect(result.payment).toBeNull();
    expect(result.rejectedReason).toBe("source not enabled");
  });
});
