import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Volume2, Wifi, WifiOff } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { colors, spacing, borderRadius, formatCurrency } from "@shared/theme";

export default function DashboardScreen() {
  const { pairedDevice, connectionStatus } = useDeviceStore();
  const isConnected = connectionStatus === "connected";

  const todayCount = 0;
  const todayTotalPaise = 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Dashboard" subtitle="Universal UPI Speaker" />

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          {isConnected ? (
            <Wifi size={18} color={colors.success[600]} />
          ) : (
            <WifiOff size={18} color={colors.slate[400]} />
          )}
          <Text style={styles.cardTitle}>Connection</Text>
        </View>
        <StatusBadge
          label={isConnected ? "Connected" : "Disconnected"}
          tone={isConnected ? "success" : "neutral"}
        />
        <Text style={styles.cardMeta}>
          {pairedDevice ? pairedDevice.name : "No device paired"}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.card, styles.statCard]}>
          <Text style={styles.statLabel}>Today's Payments</Text>
          <Text style={styles.statValue}>{todayCount}</Text>
        </View>
        <View style={[styles.card, styles.statCard]}>
          <Text style={styles.statLabel}>Today's Total</Text>
          <Text style={styles.statValue}>{formatCurrency(todayTotalPaise)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last Payment</Text>
        <Text style={styles.cardMeta}>No payments yet</Text>
      </View>

      <Pressable style={styles.testButton} disabled={!isConnected}>
        <Volume2 size={18} color={colors.white} />
        <Text style={styles.testButtonLabel}>Test Speaker</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  content: {
    paddingBottom: spacing["3xl"],
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate[800],
  },
  cardMeta: {
    fontSize: 13,
    color: colors.slate[500],
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing.lg,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 0,
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate[500],
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.slate[900],
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  testButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
});
