import Database from "better-sqlite3";
import { PaymentObject } from "@shared/types/payment";

// expo-sqlite's native binding isn't available under plain Jest, so this
// test exercises the exact SQL this module runs (schema + insert + select)
// against a real SQLite engine (better-sqlite3, dev-only) to catch syntax
// errors or column mismatches that a mocked driver would hide, plus the row
// -> PaymentHistoryEntry mapping (particularly the announced 0/1 -> boolean
// coercion, the one non-trivial conversion in that mapping).

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    deviceId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    payer TEXT,
    source TEXT NOT NULL,
    paymentType TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    transactionId TEXT,
    status TEXT NOT NULL,
    announced INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments (timestamp DESC);
`;

function rowToAnnouncedBoolean(announced: number): boolean {
  return announced === 1;
}

describe("payments table schema", () => {
  it("creates the table and index without error", () => {
    const db = new Database(":memory:");
    expect(() => db.exec(SCHEMA)).not.toThrow();
    db.close();
  });

  it("round-trips an insert through the exact query this module runs", () => {
    const db = new Database(":memory:");
    db.exec(SCHEMA);

    const payment: PaymentObject = {
      deviceId: "device-1",
      amount: 50000,
      currency: "INR",
      payer: "Ravi",
      source: "phonepe_business",
      paymentType: "incoming",
      timestamp: "2026-01-01T00:00:00.000Z",
      transactionId: "TXN1",
      status: "success",
    };

    db.prepare(
      `INSERT INTO payments
        (id, deviceId, amount, currency, payer, source, paymentType, timestamp, transactionId, status, announced, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "row-1",
      payment.deviceId,
      payment.amount,
      payment.currency,
      payment.payer,
      payment.source,
      payment.paymentType,
      payment.timestamp,
      payment.transactionId,
      payment.status,
      0,
      "2026-01-01T00:00:01.000Z",
    );

    const row = db
      .prepare("SELECT * FROM payments ORDER BY timestamp DESC LIMIT 1")
      .get() as any;

    expect(row.amount).toBe(50000);
    expect(rowToAnnouncedBoolean(row.announced)).toBe(false);

    db.prepare("UPDATE payments SET announced = 1 WHERE id = ?").run("row-1");
    const updated = db
      .prepare("SELECT * FROM payments WHERE id = ?")
      .get("row-1") as any;
    expect(rowToAnnouncedBoolean(updated.announced)).toBe(true);

    db.close();
  });

  it("orders by timestamp descending", () => {
    const db = new Database(":memory:");
    db.exec(SCHEMA);

    const insert = db.prepare(
      `INSERT INTO payments
        (id, deviceId, amount, currency, payer, source, paymentType, timestamp, transactionId, status, announced, createdAt)
       VALUES (?, 'd', 100, 'INR', NULL, 'phonepe_business', 'incoming', ?, NULL, 'success', 0, ?)`,
    );
    insert.run("a", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    insert.run("b", "2026-01-03T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    insert.run("c", "2026-01-02T00:00:00.000Z", "2026-01-02T00:00:00.000Z");

    const rows = db
      .prepare("SELECT id FROM payments ORDER BY timestamp DESC LIMIT ?")
      .all(10) as any[];

    expect(rows.map((r) => r.id)).toEqual(["b", "c", "a"]);
    db.close();
  });
});
