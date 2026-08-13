import * as SQLite from "expo-sqlite";
import { PaymentHistoryEntry, PaymentObject } from "@shared/types/payment";
import { generateId } from "@shared/utils/id";

const DB_NAME = "universal_speaker.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
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
      `);
      return db;
    });
  }
  return dbPromise;
}

interface PaymentRow {
  id: string;
  deviceId: string;
  amount: number;
  currency: string;
  payer: string | null;
  source: string;
  paymentType: string;
  timestamp: string;
  transactionId: string | null;
  status: string;
  announced: number;
  createdAt: string;
}

function rowToEntry(row: PaymentRow): PaymentHistoryEntry {
  return {
    id: row.id,
    deviceId: row.deviceId,
    amount: row.amount,
    currency: row.currency,
    payer: row.payer,
    source: row.source as PaymentHistoryEntry["source"],
    paymentType: row.paymentType as PaymentHistoryEntry["paymentType"],
    timestamp: row.timestamp,
    transactionId: row.transactionId,
    status: row.status as PaymentHistoryEntry["status"],
    announced: row.announced === 1,
    createdAt: row.createdAt,
  };
}

export async function insertPayment(payment: PaymentObject): Promise<PaymentHistoryEntry> {
  const db = await getDb();
  const entry: PaymentHistoryEntry = {
    ...payment,
    id: generateId(),
    announced: false,
    createdAt: new Date().toISOString(),
  };

  await db.runAsync(
    `INSERT INTO payments
      (id, deviceId, amount, currency, payer, source, paymentType, timestamp, transactionId, status, announced, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.deviceId,
      entry.amount,
      entry.currency,
      entry.payer,
      entry.source,
      entry.paymentType,
      entry.timestamp,
      entry.transactionId,
      entry.status,
      entry.announced ? 1 : 0,
      entry.createdAt,
    ],
  );

  return entry;
}

export async function markAnnounced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE payments SET announced = 1 WHERE id = ?", [id]);
}

export async function getRecentPayments(limit = 200): Promise<PaymentHistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PaymentRow>(
    "SELECT * FROM payments ORDER BY timestamp DESC LIMIT ?",
    [limit],
  );
  return rows.map(rowToEntry);
}

export async function clearAllPayments(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM payments");
}
