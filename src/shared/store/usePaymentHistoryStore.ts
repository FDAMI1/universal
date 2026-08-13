import { create } from "zustand";
import { PaymentHistoryEntry, PaymentObject } from "@shared/types/payment";
import { generateId } from "@shared/utils/id";

interface PaymentHistoryState {
  entries: PaymentHistoryEntry[];
  addPayment: (payment: PaymentObject) => void;
}

// In-memory for now; Module 5 (local SQLite persistence) lands separately —
// this store is the seam the persistence layer will hook into without
// changing anything that reads from it.
export const usePaymentHistoryStore = create<PaymentHistoryState>((set) => ({
  entries: [],
  addPayment: (payment) =>
    set((state) => ({
      entries: [
        {
          ...payment,
          id: generateId(),
          announced: false,
          createdAt: new Date().toISOString(),
        },
        ...state.entries,
      ],
    })),
}));
