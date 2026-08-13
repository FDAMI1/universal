import React from "react";
import { View, StyleSheet } from "react-native";
import { QrCode } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import EmptyState from "@shared/components/EmptyState";
import { colors } from "@shared/theme";

export default function DevicePairingScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Device Pairing" subtitle="Connect your ESP32 sound box" />
      <EmptyState
        icon={QrCode}
        title="No device paired"
        description="Scan the QR code shown on your ESP32 device, or enter its pairing PIN."
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
