import React, { useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { Receipt, Trash2 } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import EmptyState from "@shared/components/EmptyState";
import { usePaymentHistoryStore } from "@shared/store/usePaymentHistoryStore";
import { PaymentHistoryEntry } from "@shared/types/payment";
import { colors, spacing, borderRadius, formatCurrency, formatDateTime } from "@shared/theme";

const SOURCE_LABELS: Record<PaymentHistoryEntry["source"], string> = {
  phonepe_business: "PhonePe Business",
  paytm_business: "Paytm Business",
  google_pay: "Google Pay",
  google_pay_personal: "Personal Google Pay",
  bank_sms: "Bank SMS",
};

function HistoryRow({ entry }: { entry: PaymentHistoryEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowAmount}>{formatCurrency(entry.amount, entry.currency)}</Text>
        <Text style={styles.rowMeta}>
          {SOURCE_LABELS[entry.source]}
          {entry.payer ? ` · ${entry.payer}` : ""}
        </Text>
        <Text style={styles.rowMeta}>{formatDateTime(entry.timestamp)}</Text>
      </View>
    </View>
  );
}

export default function PaymentHistoryScreen() {
  const entries = usePaymentHistoryStore((state) => state.entries);
  const clear = usePaymentHistoryStore((state) => state.clear);

  const handleClear = useCallback(() => {
    Alert.alert(
      "Clear payment history",
      "This permanently deletes all recorded payments from this device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => clear() },
      ],
    );
  }, [clear]);

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payment History" subtitle="Stored locally on this device" />
        <EmptyState
          icon={Receipt}
          title="No payments recorded yet"
          description="Successful payments detected from your sources will appear here."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ScreenHeader title="Payment History" subtitle="Stored locally on this device" />
        <Pressable style={styles.clearButton} onPress={handleClear} hitSlop={8}>
          <Trash2 size={18} color={colors.error[600]} />
        </Pressable>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <HistoryRow entry={item} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: spacing.lg,
  },
  clearButton: {
    padding: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  rowText: {
    gap: 2,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.slate[900],
  },
  rowMeta: {
    fontSize: 12,
    color: colors.slate[500],
  },
});
