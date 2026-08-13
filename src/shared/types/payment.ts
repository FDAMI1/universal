export type PaymentSource =
  | "phonepe_business"
  | "paytm_business"
  | "google_pay"
  | "google_pay_personal"
  | "bank_sms";

export type PaymentStatus = "success" | "failed" | "pending";

export interface PaymentObject {
  deviceId: string;
  amount: number; // integer paise
  currency: string; // ISO 4217, e.g. "INR"
  payer: string | null;
  source: PaymentSource;
  paymentType: "incoming" | "outgoing";
  timestamp: string; // ISO 8601
  transactionId: string | null;
  status: PaymentStatus;
}

export interface PaymentHistoryEntry extends PaymentObject {
  id: string;
  announced: boolean;
  createdAt: string;
}
