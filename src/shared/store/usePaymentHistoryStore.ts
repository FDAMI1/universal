import { create } from "zustand";
import { PaymentHistoryEntry, PaymentObject } from "@shared/types/payment";
import {
  insertPayment,
  getRecentPayments,
  markAnnounced as markAnnouncedInDb,
  clearAllPayments,
} from "@shared/db/paymentDb";

interface PaymentHistoryState {
  entries: PaymentHistoryEntry[];
  isLoaded: boolean;
  loadFromDb: () => Promise<void>;
  addPayment: (payment: PaymentObject) => Promise<PaymentHistoryEntry>;
  markAnnounced: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

// SQLite is the source of truth (survives app restarts, per PDR Module 5:
// "Store locally on the phone"); `entries` is a reactive cache the UI reads
// from so screens don't need to await a query on every render.
export const usePaymentHistoryStore = create<PaymentHistoryState>((set) => ({
  entries: [],
  isLoaded: false,

  loadFromDb: async () => {
    const entries = await getRecentPayments();
    set({ entries, isLoaded: true });
  },

  addPayment: async (payment) => {
    const entry = await insertPayment(payment);
    set((state) => ({ entries: [entry, ...state.entries] }));
    return entry;
  },

  markAnnounced: async (id) => {
    await markAnnouncedInDb(id);
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id ? { ...entry, announced: true } : entry,
      ),
    }));
  },

  clear: async () => {
    await clearAllPayments();
    set({ entries: [] });
  },
}));
