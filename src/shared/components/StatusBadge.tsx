import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, borderRadius, spacing } from "@shared/theme";

type BadgeTone = "success" | "warning" | "error" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
}

const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
  success: { bg: colors.success[100], text: colors.success[700] },
  warning: { bg: colors.warning[100], text: colors.warning[700] },
  error: { bg: colors.error[100], text: colors.error[700] },
  neutral: { bg: colors.slate[100], text: colors.slate[600] },
};

export default function StatusBadge({ label, tone }: StatusBadgeProps) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
