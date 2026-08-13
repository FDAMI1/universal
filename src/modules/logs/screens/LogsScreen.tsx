import React from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { ScrollText, CheckCircle2, XCircle } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import EmptyState from "@shared/components/EmptyState";
import { useActivityLogStore, ActivityLogEntry } from "@shared/store/useActivityLogStore";
import { colors, spacing, borderRadius, formatCurrency, formatDateTime } from "@shared/theme";

function LogRow({ entry }: { entry: ActivityLogEntry }) {
  if (entry.type === "payment") {
    return (
      <View style={styles.row}>
        <CheckCircle2 size={18} color={colors.success[600]} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>
            {formatCurrency(entry.payment.amount)} from {entry.payment.source}
          </Text>
          <Text style={styles.rowMeta}>{formatDateTime(entry.at)}</Text>
        </View>
      </View>
    );
  }

  if (entry.type === "rejected") {
    return (
      <View style={styles.row}>
        <XCircle size={18} color={colors.slate[400]} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Ignored: {entry.packageName}</Text>
          <Text style={styles.rowMeta}>
            {entry.reason} · {formatDateTime(entry.at)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{entry.message}</Text>
        <Text style={styles.rowMeta}>{formatDateTime(entry.at)}</Text>
      </View>
    </View>
  );
}

export default function LogsScreen() {
  const entries = useActivityLogStore((state) => state.entries);

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Logs" subtitle="Connection, payment & announcement activity" />
        <EmptyState
          icon={ScrollText}
          title="No log entries yet"
          description="Connection events, parsed payments, announcements, and errors will show up here."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Logs" subtitle="Connection, payment & announcement activity" />
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <LogRow entry={item} />}
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["3xl"],
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate[100],
    marginBottom: spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate[800],
  },
  rowMeta: {
    fontSize: 12,
    color: colors.slate[500],
  },
});
