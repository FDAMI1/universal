import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { BellRing, CheckCircle2, ExternalLink } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import { usePaymentNotificationListener } from "@modules/notifications/hooks/usePaymentNotificationListener";
import { colors, spacing, borderRadius } from "@shared/theme";

export default function NotificationAccessScreen() {
  const { accessGranted, listenerConnected, openSettings } =
    usePaymentNotificationListener();

  if (Platform.OS !== "android") {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Notification Access" />
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Notification listening is only available on Android.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Notification Access" subtitle="Required to detect payments" />

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          {accessGranted ? (
            <CheckCircle2 size={20} color={colors.success[600]} />
          ) : (
            <BellRing size={20} color={colors.warning[600]} />
          )}
          <Text style={styles.cardTitle}>Notification Access</Text>
        </View>
        <StatusBadge
          label={accessGranted ? "Granted" : "Not granted"}
          tone={accessGranted ? "success" : "warning"}
        />
        <Text style={styles.cardText}>
          {accessGranted
            ? "The app can read payment notifications from your enabled sources."
            : "Grant notification access so the app can detect payment notifications from PhonePe, Paytm, and Google Pay."}
        </Text>
      </View>

      {accessGranted ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Listener Status</Text>
          <StatusBadge
            label={listenerConnected ? "Running" : "Not running"}
            tone={listenerConnected ? "success" : "neutral"}
          />
        </View>
      ) : null}

      <Pressable style={styles.settingsButton} onPress={openSettings}>
        <ExternalLink size={18} color={colors.white} />
        <Text style={styles.settingsButtonLabel}>Open Notification Access Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
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
  cardText: {
    fontSize: 13,
    color: colors.slate[500],
    lineHeight: 18,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  settingsButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
});
