import React from "react";
import { View, Text, StyleSheet, ScrollView, Switch } from "react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import { useSettingsStore } from "@shared/store/useSettingsStore";
import { PaymentSource } from "@shared/types/payment";
import { colors, spacing, borderRadius } from "@shared/theme";

const SOURCE_LABELS: Record<PaymentSource, string> = {
  phonepe_business: "PhonePe Business",
  paytm_business: "Paytm Business",
  google_pay: "Google Pay (Business)",
  google_pay_personal: "Personal Google Pay",
  bank_sms: "Bank SMS",
};

export default function SettingsScreen() {
  const { enabledSources, setSourceEnabled } = useSettingsStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" subtitle="Sources & announcements" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Source Management</Text>
        <View style={styles.card}>
          {(Object.keys(SOURCE_LABELS) as PaymentSource[]).map((source, index) => (
            <View
              key={source}
              style={[
                styles.row,
                index < Object.keys(SOURCE_LABELS).length - 1 && styles.rowDivider,
              ]}
            >
              <Text style={styles.rowLabel}>{SOURCE_LABELS[source]}</Text>
              <Switch
                value={enabledSources[source]}
                onValueChange={(value) => setSourceEnabled(source, value)}
                trackColor={{ true: colors.primary[500], false: colors.slate[200] }}
              />
            </View>
          ))}
        </View>
      </View>
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
  },
  section: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate[500],
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.slate[100],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  rowLabel: {
    fontSize: 14,
    color: colors.slate[800],
  },
});
