import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { RefreshCw, Wifi, CheckCircle2 } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import { useDevicePairing } from "@modules/pairing/hooks/useDevicePairing";
import {
  finishSetup,
  readStatus,
  requestWifiConnect,
  scanNetworks,
  type PortalStatus,
} from "@modules/pairing/api/setupPortalApi";
import { colors, spacing, borderRadius } from "@shared/theme";

type Step = "join" | "credentials" | "connecting" | "connected";

const STATUS_POLL_INTERVAL_MS = 1_500;
/** The firmware gives up on a network after 20s; allow a little more. */
const CONNECT_TIMEOUT_MS = 30_000;

export default function SpeakerWifiSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isPairing, error: pairError, pairManually } = useDevicePairing();

  const [step, setStep] = useState<Step>("join");
  const [networks, setNetworks] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<PortalStatus | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    },
    [],
  );

  const handleScan = useCallback(async () => {
    setError(null);
    setIsScanning(true);
    try {
      setNetworks(await scanNetworks());
      setStep("credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScanning(false);
    }
  }, []);

  const pollUntilSettled = useCallback((deadline: number) => {
    readStatus()
      .then((status) => {
        if (status.state === "connected") {
          setDetails(status);
          setStep("connected");
          return;
        }
        if (status.state === "failed") {
          setStep("credentials");
          setError(
            "The speaker couldn't join that network. Check the name and " +
              "password, and make sure it's a 2.4GHz network.",
          );
          return;
        }
        if (Date.now() > deadline) {
          setStep("credentials");
          setError("The speaker didn't respond in time. Try again.");
          return;
        }
        pollTimer.current = setTimeout(
          () => pollUntilSettled(deadline),
          STATUS_POLL_INTERVAL_MS,
        );
      })
      .catch(() => {
        // A dropped poll is normal while the radio switches networks.
        if (Date.now() > deadline) {
          setStep("credentials");
          setError("Lost contact with the speaker. Try again.");
          return;
        }
        pollTimer.current = setTimeout(
          () => pollUntilSettled(deadline),
          STATUS_POLL_INTERVAL_MS,
        );
      });
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    setStep("connecting");
    try {
      await requestWifiConnect(ssid.trim(), password);
      pollUntilSettled(Date.now() + CONNECT_TIMEOUT_MS);
    } catch (err) {
      setStep("credentials");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [ssid, password, pollUntilSettled]);

  const handlePair = useCallback(async () => {
    if (!details?.deviceId || !details.ip || !details.pin) return;
    // The speaker is on the new network now, so let it leave setup mode. It
    // may already be gone, which is why a failure here isn't fatal.
    void finishSetup().catch(() => {});
    const paired = await pairManually(details.deviceId, details.ip, details.pin);
    if (paired) navigation.goBack();
  }, [details, pairManually, navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing["3xl"] },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title="Speaker Wi-Fi"
        subtitle="Put your speaker on your Wi-Fi network"
      />

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === "join" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Join the speaker's Wi-Fi</Text>
          <Text style={styles.cardText}>
            Power on the speaker. In your phone's Wi-Fi settings, join the
            network named <Text style={styles.strong}>Speaker-Setup-…</Text>.
            It has no password.
          </Text>
          <Text style={styles.cardText}>
            Android may warn that it has no internet — choose to stay
            connected. Turning mobile data off makes this more reliable.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={handleScan}
            disabled={isScanning}
            accessibilityRole="button"
          >
            {isScanning ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>
                I've joined it — continue
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {step === "credentials" && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Wifi size={18} color={colors.slate[600]} />
            <Text style={styles.cardTitle}>2. Choose your Wi-Fi</Text>
            <Pressable onPress={handleScan} hitSlop={8} disabled={isScanning}>
              <RefreshCw size={16} color={colors.primary[600]} />
            </Pressable>
          </View>

          {networks.length > 0 ? (
            <View style={styles.networkList}>
              {networks.map((name) => (
                <Pressable
                  key={name}
                  style={[
                    styles.networkRow,
                    ssid === name && styles.networkRowActive,
                  ]}
                  onPress={() => setSsid(name)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ssid === name }}
                >
                  <Text style={styles.networkName} numberOfLines={1}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.cardText}>
              The speaker found no networks nearby. Tap refresh, or type the
              name below.
            </Text>
          )}

          <TextInput
            style={styles.input}
            placeholder="Wi-Fi name"
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Wi-Fi password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            The speaker only supports 2.4GHz networks, which nearly all home
            routers and phone hotspots provide.
          </Text>
          <Pressable
            style={[
              styles.primaryButton,
              !ssid.trim() && styles.primaryButtonDisabled,
            ]}
            disabled={!ssid.trim()}
            onPress={handleConnect}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonLabel}>Connect speaker</Text>
          </Pressable>
        </View>
      )}

      {step === "connecting" && (
        <View style={styles.card}>
          <ActivityIndicator color={colors.primary[600]} />
          <Text style={styles.cardText}>
            Connecting the speaker to "{ssid}". This takes up to 20 seconds.
          </Text>
        </View>
      )}

      {step === "connected" && details ? (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <CheckCircle2 size={20} color={colors.success[600]} />
            <Text style={styles.cardTitle}>3. Speaker is online</Text>
          </View>
          <View style={styles.detailsBox}>
            <Text style={styles.detailRow}>Device ID: {details.deviceId}</Text>
            <Text style={styles.detailRow}>IP address: {details.ip}</Text>
            <Text style={styles.detailRow}>PIN: {details.pin}</Text>
          </View>
          <Text style={styles.cardText}>
            Now switch your phone back to "{ssid}", then tap below to pair.
            Both have to be on the same network.
          </Text>
          {pairError ? (
            <Text style={styles.errorText}>{pairError}</Text>
          ) : null}
          <Pressable
            style={styles.primaryButton}
            onPress={handlePair}
            disabled={isPairing}
            accessibilityRole="button"
          >
            {isPairing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>
                I've switched — pair now
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
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
  cardText: {
    fontSize: 13,
    color: colors.slate[500],
    lineHeight: 19,
  },
  strong: {
    fontWeight: "700",
    color: colors.slate[700],
  },
  hint: {
    fontSize: 12,
    color: colors.slate[400],
  },
  networkList: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  networkRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  networkRowActive: {
    backgroundColor: colors.primary[50],
  },
  networkName: {
    fontSize: 14,
    color: colors.slate[800],
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
  detailsBox: {
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailRow: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate[800],
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
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
    lineHeight: 18,
  },
});
