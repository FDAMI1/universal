import { create } from "zustand";
import { PaymentObject } from "@shared/types/payment";

export type ActivityLogEntry =
  | { id: string; type: "payment"; at: string; payment: PaymentObject }
  | { id: string; type: "rejected"; at: string; packageName: string; reason: string }
  | { id: string; type: "connection"; at: string; message: string }
  | { id: string; type: "error"; at: string; message: string };

interface ActivityLogState {
  entries: ActivityLogEntry[];
  addEntry: (entry: ActivityLogEntry) => void;
  clear: () => void;
}

const MAX_ENTRIES = 200;

export const useActivityLogStore = create<ActivityLogState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => ({
      entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
    })),
  clear: () => set({ entries: [] }),
}));
