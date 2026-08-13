import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { QrCode, Keyboard, Trash2, CheckCircle2 } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { useDevicePairing } from "@modules/pairing/hooks/useDevicePairing";
import { colors, spacing, borderRadius } from "@shared/theme";

function PairedDeviceCard() {
  const { pairedDevice, connectionStatus, setPairedDevice } = useDeviceStore();
  if (!pairedDevice) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <CheckCircle2 size={20} color={colors.success[600]} />
        <Text style={styles.cardTitle}>{pairedDevice.name}</Text>
      </View>
      <StatusBadge
        label={connectionStatus === "connected" ? "Connected" : "Not connected"}
        tone={connectionStatus === "connected" ? "success" : "neutral"}
      />
      <Text style={styles.cardMeta}>{pairedDevice.ipAddress}</Text>
      <Pressable
        style={styles.removeButton}
        onPress={() => setPairedDevice(null)}
      >
        <Trash2 size={16} color={colors.error[600]} />
        <Text style={styles.removeButtonLabel}>Remove device</Text>
      </Pressable>
    </View>
  );
}

function ManualPairForm({
  onSubmit,
  isPairing,
}: {
  onSubmit: (deviceId: string, ip: string, pin: string) => void;
  isPairing: boolean;
}) {
  const [deviceId, setDeviceId] = useState("");
  const [ip, setIp] = useState("");
  const [pin, setPin] = useState("");

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Keyboard size={18} color={colors.slate[600]} />
        <Text style={styles.cardTitle}>Enter details manually</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Device ID"
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="IP address (e.g. 192.168.1.50)"
        value={ip}
        onChangeText={setIp}
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <TextInput
        style={styles.input}
        placeholder="PIN shown on device"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
      />
      <Pressable
        style={[styles.submitButton, (!deviceId || !ip || !pin) && styles.submitButtonDisabled]}
        disabled={!deviceId || !ip || !pin || isPairing}
        onPress={() => onSubmit(deviceId, ip, pin)}
      >
        {isPairing ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.submitButtonLabel}>Pair Device</Text>
        )}
      </Pressable>
    </View>
  );
}

function QrScanner({ onScan }: { onScan: (data: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>
          Camera access is needed to scan the device's pairing QR code.
        </Text>
        <Pressable style={styles.submitButton} onPress={requestPermission}>
          <Text style={styles.submitButtonLabel}>Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.scannerCard}>
      <CameraView
        style={styles.scanner}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                onScan(data);
                setTimeout(() => setScanned(false), 3000);
              }
        }
      />
    </View>
  );
}

export default function DevicePairingScreen() {
  const pairedDevice = useDeviceStore((state) => state.pairedDevice);
  const { isPairing, error, pairFromQrData, pairManually } = useDevicePairing();
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleScan = useCallback(
    (data: string) => {
      pairFromQrData(data);
    },
    [pairFromQrData],
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Device Pairing" subtitle="Connect your ESP32 sound box" />

      {pairedDevice ? (
        <PairedDeviceCard />
      ) : (
        <>
          {!showManualEntry && <QrScanner onScan={handleScan} />}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {showManualEntry ? (
            <ManualPairForm onSubmit={pairManually} isPairing={isPairing} />
          ) : (
            <Pressable
              style={styles.linkButton}
              onPress={() => setShowManualEntry(true)}
            >
              <Keyboard size={16} color={colors.primary[600]} />
              <Text style={styles.linkButtonLabel}>Enter details manually instead</Text>
            </Pressable>
          )}

          {showManualEntry ? (
            <Pressable style={styles.linkButton} onPress={() => setShowManualEntry(false)}>
              <QrCode size={16} color={colors.primary[600]} />
              <Text style={styles.linkButtonLabel}>Scan QR code instead</Text>
            </Pressable>
          ) : null}
        </>
      )}
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
  cardMeta: {
    fontSize: 13,
    color: colors.slate[500],
  },
  scannerCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  scanner: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.slate[800],
  },
  submitButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  linkButtonLabel: {
    color: colors.primary[600],
    fontWeight: "600",
    fontSize: 13,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  removeButtonLabel: {
    color: colors.error[600],
    fontWeight: "600",
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: colors.error[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.error[700],
    fontSize: 13,
  },
});
