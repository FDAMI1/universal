import React from "react";
import { View, StyleSheet } from "react-native";
import { Receipt } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import EmptyState from "@shared/components/EmptyState";
import { colors } from "@shared/theme";

export default function PaymentHistoryScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
});
