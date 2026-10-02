import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@navigation/AppNavigator";
import {
  QrCode,
  Keyboard,
  Trash2,
  CheckCircle2,
  Pencil,
  Volume2,
  Wifi,
  Search,
  Speaker as SpeakerIcon,
} from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import { useDeviceStore } from "@shared/store/useDeviceStore";
import { useDevicePairing } from "@modules/pairing/hooks/useDevicePairing";
import {
  discoverSpeakers,
  type DiscoveredSpeaker,
} from "@modules/pairing/api/discovery";
import { getActiveEsp32Connection } from "@shared/net/useEsp32ConnectionManager";
import { colors, spacing, borderRadius } from "@shared/theme";

function PairedDeviceCard() {
  const { pairedDevice, connectionStatus, setPairedDevice, renameDevice } =
    useDeviceStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(pairedDevice?.name ?? "");
  const [isTesting, setIsTesting] = useState(false);

  if (!pairedDevice) return null;

  const handleRemove = () => {
    Alert.alert(
      "Release speaker",
      `Disconnect "${pairedDevice.name}" from this phone? The speaker becomes ` +
        "available for another phone to connect.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          style: "destructive",
          onPress: async () => {
            const connection = getActiveEsp32Connection();
            if (connection) {
              try {
                // Tell the speaker to forget this phone. If it's unreachable,
                // the user can still hold its BOOT button to reset it.
                await connection.send({
                  type: "unpair",
                  deviceId: pairedDevice.id,
                  authToken: pairedDevice.authToken,
                });
              } catch {
                Alert.alert(
                  "Speaker not reachable",
                  "This phone has been disconnected, but the speaker still " +
                    "thinks it owns it. Hold its BOOT button for eight " +
                    "seconds, or press BOOT once to let a new phone pair.",
                );
              }
            }
            setPairedDevice(null);
          },
        },
      ],
    );
  };

  const handleTestConnection = async () => {
    const connection = getActiveEsp32Connection();
    if (!connection) return;
    setIsTesting(true);
    try {
      await connection.send({
        type: "test_speaker",
        deviceId: pairedDevice.id,
        authToken: pairedDevice.authToken,
      });
      Alert.alert(
        "Test sent",
        "Your speaker should now say that it's ready for payments.",
      );
    } catch (error) {
      Alert.alert(
        "Test failed",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <CheckCircle2 size={20} color={colors.success[600]} />
        {isEditingName ? (
          <TextInput
            style={styles.nameInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            onSubmitEditing={() => {
              if (nameDraft.trim()) renameDevice(nameDraft.trim());
              setIsEditingName(false);
            }}
            onBlur={() => setIsEditingName(false)}
          />
        ) : (
          <Text style={styles.cardTitle}>{pairedDevice.name}</Text>
        )}
        <Pressable
          onPress={() => {
            setNameDraft(pairedDevice.name);
            setIsEditingName(true);
          }}
          hitSlop={8}
        >
          <Pencil size={14} color={colors.slate[400]} />
        </Pressable>
      </View>
      <StatusBadge
        label={connectionStatus === "connected" ? "Connected" : "Not connected"}
        tone={connectionStatus === "connected" ? "success" : "neutral"}
      />
      <Text style={styles.cardMeta}>{pairedDevice.ipAddress}</Text>

      <Pressable
        style={[
          styles.testButton,
          connectionStatus !== "connected" && styles.testButtonDisabled,
        ]}
        onPress={handleTestConnection}
        disabled={connectionStatus !== "connected" || isTesting}
        accessibilityRole="button"
        accessibilityLabel="Play a test announcement on the speaker"
      >
        {isTesting ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Volume2 size={18} color={colors.white} />
        )}
        <Text style={styles.testButtonLabel}>
          {isTesting ? "Playing…" : "Play test announcement"}
        </Text>
      </Pressable>
      <Text style={styles.cardMeta}>
        The speaker says "स्पीकर तैयार है" — speaker is ready.
      </Text>

      <Pressable style={styles.removeButton} onPress={handleRemove}>
        <Trash2 size={16} color={colors.error[600]} />
        <Text style={styles.removeButtonLabel}>Release speaker</Text>
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
        style={[
          styles.submitButton,
          (!deviceId || !ip || !pin) && styles.submitButtonDisabled,
        ]}
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

function DiscoveryCard({
  onConnect,
  isPairing,
}: {
  onConnect: (speaker: DiscoveredSpeaker) => void;
  isPairing: boolean;
}) {
  const [speakers, setSpeakers] = useState<DiscoveredSpeaker[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async () => {
    setIsSearching(true);
    setSpeakers([]);
    try {
      // Show each speaker the moment it answers rather than after the sweep.
      await discoverSpeakers((found) =>
        setSpeakers((current) =>
          current.some((s) => s.deviceId === found.deviceId)
            ? current
            : [...current, found],
        ),
      );
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    void search();
  }, [search]);

  const blocked = (speaker: DiscoveredSpeaker) =>
    speaker.claimed && !speaker.pairingOpen;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Search size={18} color={colors.slate[600]} />
        <Text style={styles.cardTitle}>Speakers on your Wi-Fi</Text>
        {isSearching ? (
          <ActivityIndicator size="small" color={colors.primary[600]} />
        ) : (
          <Pressable onPress={search} hitSlop={8}>
            <Text style={styles.linkButtonLabel}>Search again</Text>
          </Pressable>
        )}
      </View>

      {speakers.map((speaker) => (
        <View key={speaker.deviceId} style={styles.foundRow}>
          <SpeakerIcon size={20} color={colors.primary[600]} />
          <View style={styles.foundText}>
            <Text style={styles.foundName}>{speaker.deviceName}</Text>
            <Text style={styles.cardMeta}>
              {speaker.deviceId} - {speaker.ipAddress}
            </Text>
            {blocked(speaker) ? (
              <Text style={styles.foundWarning}>
                Already connected to another device. Release it there, or press
                this speaker's BOOT button once.
              </Text>
            ) : null}
          </View>
          <Pressable
            style={[
              styles.connectButton,
              (isPairing || blocked(speaker)) && styles.connectButtonDisabled,
            ]}
            disabled={isPairing || blocked(speaker)}
            onPress={() => onConnect(speaker)}
            accessibilityRole="button"
          >
            <Text style={styles.connectButtonLabel}>Connect</Text>
          </Pressable>
        </View>
      ))}

      {isSearching && speakers.length === 0 ? (
        <Text style={styles.cardText}>
          Looking for speakers on your network...
        </Text>
      ) : null}

      {!isSearching && hasSearched && speakers.length === 0 ? (
        <Text style={styles.cardText}>
          No speakers found. Check that the speaker is powered on and that this
          phone is on the same Wi-Fi it was set up with. A brand-new speaker
          has no Wi-Fi yet, so use "Set up a new speaker" above.
        </Text>
      ) : null}
    </View>
  );
}

export default function DevicePairingScreen() {
  const pairedDevice = useDeviceStore((state) => state.pairedDevice);
  const { isPairing, error, pairFromQrData, pairManually, pairDiscovered } =
    useDevicePairing();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleScan = useCallback(
    (data: string) => {
      pairFromQrData(data);
    },
    [pairFromQrData],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Device Pairing"
        subtitle="Connect your ESP32 sound box"
      />

      {pairedDevice ? (
        <PairedDeviceCard />
      ) : (
        <>
          <Pressable
            style={styles.setupCard}
            onPress={() => navigation.navigate("SpeakerWifiSetup")}
            accessibilityRole="button"
          >
            <View style={styles.cardHeaderRow}>
              <Wifi size={18} color={colors.primary[600]} />
              <Text style={styles.setupTitle}>Set up a new speaker</Text>
            </View>
            <Text style={styles.cardText}>
              Put the speaker on your Wi-Fi and pair it, step by step. Start
              here if this speaker has never been connected.
            </Text>
          </Pressable>

          <DiscoveryCard onConnect={pairDiscovered} isPairing={isPairing} />

          {showScanner && <QrScanner onScan={handleScan} />}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {showManualEntry ? (
            <ManualPairForm onSubmit={pairManually} isPairing={isPairing} />
          ) : null}

          <Pressable
            style={styles.linkButton}
            onPress={() => setShowManualEntry((shown) => !shown)}
          >
            <Keyboard size={16} color={colors.primary[600]} />
            <Text style={styles.linkButtonLabel}>
              {showManualEntry
                ? "Hide manual entry"
                : "Enter details manually instead"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.linkButton}
            onPress={() => setShowScanner((shown) => !shown)}
          >
            <QrCode size={16} color={colors.primary[600]} />
            <Text style={styles.linkButtonLabel}>
              {showScanner ? "Hide QR scanner" : "Scan a QR code instead"}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing["3xl"],
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
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate[800],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[200],
    paddingVertical: 0,
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
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  testButtonDisabled: {
    opacity: 0.5,
  },
  testButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
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
  foundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  foundText: {
    flex: 1,
    gap: 2,
  },
  foundName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate[800],
  },
  foundWarning: {
    fontSize: 12,
    color: colors.warning[700],
    lineHeight: 16,
  },
  connectButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  connectButtonDisabled: {
    opacity: 0.4,
  },
  connectButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
  setupCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  setupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary[700],
    flex: 1,
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
