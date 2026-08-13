import { useMemo } from "react";
import { usePaymentHistoryStore } from "@shared/store/usePaymentHistoryStore";

export function useTodayStats() {
  const entries = usePaymentHistoryStore((state) => state.entries);

  return useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMillis = startOfToday.getTime();

    const todaysEntries = entries.filter(
      (entry) => new Date(entry.timestamp).getTime() >= startMillis,
    );

    return {
      count: todaysEntries.length,
      totalPaise: todaysEntries.reduce((sum, entry) => sum + entry.amount, 0),
      lastPayment: entries[0] ?? null,
    };
  }, [entries]);
}
