import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { colors, spacing } from "@shared/theme";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={40} color={colors.slate[300]} />
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["3xl"],
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.slate[700],
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: colors.slate[500],
    textAlign: "center",
  },
});
