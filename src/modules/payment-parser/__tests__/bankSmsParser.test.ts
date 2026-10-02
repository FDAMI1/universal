import { parseBankSmsNotification } from "../parsers/bankSmsParser";
import { enabledSourcePackages } from "../sourcePackages";
import { runPaymentPipeline } from "../paymentPipeline";
import { DuplicateDetector } from "../duplicateDetector";

const sms = (text: string, title = "JK-KOTAKD-S") => ({
  packageName: "com.google.android.apps.messaging",
  postTimeMillis: Date.now(),
  title,
  text,
  bigText: null,
  subText: null,
});

describe("bank SMS credit alerts", () => {
  it("reads the Kotak wording that a real test payment produced", () => {
    const parsed = parseBankSmsNotification(
      sms(
        "Received Rs.1.00 from FARHAN AHMAD on 02-10-26. UPI Ref 532112345678 -Kotak Bank",
      ),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.amount).toBe(100);
    expect(parsed!.payer).toBe("FARHAN AHMAD");
    expect(parsed!.transactionId).toBe("532112345678");
    expect(parsed!.paymentType).toBe("incoming");
  });

  it("still reads the 'credited' wording other banks use", () => {
    const parsed = parseBankSmsNotification(
      sms("Your a/c XX4567 is credited with INR 2,500.50 on 02-10-26. Ref No 998877665544"),
    );
    expect(parsed!.amount).toBe(250_050);
    expect(parsed!.transactionId).toBe("998877665544");
  });

  it("never announces money going out", () => {
    expect(
      parseBankSmsNotification(
        sms("Rs.500.00 debited from a/c XX4567 and sent to AMAZON"),
      ),
    ).toBeNull();
    expect(
      parseBankSmsNotification(sms("You paid Rs.250 to SHELL PETROL via UPI")),
    ).toBeNull();
    expect(
      parseBankSmsNotification(
        sms("Rs.99 spent on your card ending 1234"),
      ),
    ).toBeNull();
  });

  it("ignores messages that aren't about money", () => {
    expect(parseBankSmsNotification(sms("Your OTP is 123456"))).toBeNull();
    expect(
      parseBankSmsNotification(sms("Received your request, we'll be in touch")),
    ).toBeNull();
  });
});

describe("enabledSourcePackages", () => {
  const sources = {
    phonepe_business: true,
    paytm_business: false,
    google_pay: true,
  };

  it("includes the detected SMS app when bank SMS is on", () => {
    const packages = enabledSourcePackages({
      enabledSources: sources,
      smsEnabled: true,
      smsPackageName: "com.miui.smsextra",
    });
    expect(packages.has("com.miui.smsextra")).toBe(true);
    expect(packages.has("com.phonepe.app")).toBe(true);
    expect(packages.has("net.one97.paytm")).toBe(false);
  });

  it("falls back to the common messaging apps before one is detected", () => {
    const packages = enabledSourcePackages({
      enabledSources: sources,
      smsEnabled: true,
      smsPackageName: "",
    });
    expect(packages.has("com.google.android.apps.messaging")).toBe(true);
  });

  it("leaves messaging apps out when bank SMS is off", () => {
    const packages = enabledSourcePackages({
      enabledSources: sources,
      smsEnabled: false,
      smsPackageName: "com.miui.smsextra",
    });
    expect(packages.has("com.miui.smsextra")).toBe(false);
  });
});

describe("the whole pipeline, for the payment that was missed", () => {
  it("turns the Kotak SMS into an announceable payment", () => {
    const event = sms(
      "Received Rs.1.00 from FARHAN AHMAD on 02-10-26. UPI Ref 532112345678 -Kotak Bank",
    );
    const result = runPaymentPipeline(
      event,
      {
        deviceId: "SPK-1BA0A4",
        minimumAmountPaise: 0,
        duplicateTimeoutSeconds: 30,
        smsPackageName: event.packageName,
        enabledSourcePackages: new Set([event.packageName]),
      },
      new DuplicateDetector(30_000),
      Date.now(),
    );
    expect(result.rejectedReason).toBeUndefined();
    expect(result.payment?.amount).toBe(100);
    expect(result.payment?.source).toBe("bank_sms");
  });
});
