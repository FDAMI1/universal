import React from "react";
import { View, StyleSheet } from "react-native";
import { ScrollText } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import EmptyState from "@shared/components/EmptyState";
import { colors } from "@shared/theme";

export default function LogsScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
});
