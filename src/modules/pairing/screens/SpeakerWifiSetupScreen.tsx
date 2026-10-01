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
import {
  RefreshCw,
  Wifi,
  CheckCircle2,
  Speaker,
  TriangleAlert,
  RotateCcw,
} from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import { useDevicePairing } from "@modules/pairing/hooks/useDevicePairing";
import {
  finishSetup,
  readStatus,
  requestWifiConnect,
  resetAttempt,
  scanNetworks,
  type PortalStatus,
} from "@modules/pairing/api/setupPortalApi";
import {
  canJoinFromApp,
  joinSpeakerNetwork,
  joinedSsid,
  leaveSpeakerNetwork,
  openWifiSettings,
} from "@modules/pairing/api/speakerWifi";
import { colors, spacing, borderRadius } from "@shared/theme";

/**
 * End-to-end speaker setup without leaving the app: join the speaker's own
 * network, hand it your Wi-Fi details, watch it connect, then pair.
 *
 * Every failure lands on a state that offers Retry, so a flaky join never
 * forces the user to start over.
 */
type Step =
  | "find" // looking for / joining the speaker's own network
  | "credentials" // speaker joined, asking for the user's Wi-Fi
  | "connecting" // speaker is trying those credentials
  | "failed" // it couldn't connect — retry or edit the details
  | "connected"; // speaker is on the network; ready to pair

const STATUS_POLL_INTERVAL_MS = 1_500;
/** The firmware gives up on a network after 20s; allow a little more. */
const CONNECT_TIMEOUT_MS = 30_000;

export default function SpeakerWifiSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isPairing, error: pairError, pairManually } = useDevicePairing();

  const [step, setStep] = useState<Step>("find");
  const [speakerSsid, setSpeakerSsid] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [networks, setNetworks] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [claimedByOther, setClaimedByOther] = useState(false);
  const [details, setDetails] = useState<PortalStatus | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving mid-setup must hand the phone back to its normal network,
  // otherwise the whole app stays bound to a speaker with no internet.
  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      leaveSpeakerNetwork();
    },
    [],
  );

  const loadNetworks = useCallback(async () => {
    setIsScanning(true);
    try {
      setNetworks(await scanNetworks());
    } catch {
      // A failed scan isn't fatal — the name can always be typed in.
      setNetworks([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /** Confirms we really are talking to a speaker, and whether it's spoken for. */
  const enterCredentials = useCallback(async () => {
    const status = await readStatus();
    if (status.claimed) {
      setClaimedByOther(true);
      setError(null);
      leaveSpeakerNetwork();
      setStep("find");
      return;
    }
    setClaimedByOther(false);
    setStep("credentials");
    void loadNetworks();
  }, [loadNetworks]);

  const handleJoinSpeaker = useCallback(async () => {
    setError(null);
    setClaimedByOther(false);
    setIsJoining(true);
    try {
      const joined = await joinSpeakerNetwork();
      setSpeakerSsid(joined ?? joinedSsid());
      await enterCredentials();
    } catch (err) {
      leaveSpeakerNetwork();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsJoining(false);
    }
  }, [enterCredentials]);

  /** Android 9 and older: the user joins in Wi-Fi settings and comes back. */
  const handleManualJoin = useCallback(async () => {
    setError(null);
    setIsJoining(true);
    try {
      await enterCredentials();
      setSpeakerSsid(joinedSsid());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsJoining(false);
    }
  }, [enterCredentials]);

  const pollUntilSettled = useCallback((deadline: number) => {
    const again = () => {
      pollTimer.current = setTimeout(
        () => pollUntilSettled(deadline),
        STATUS_POLL_INTERVAL_MS,
      );
    };

    readStatus()
      .then((status) => {
        if (status.state === "connected") {
          setDetails(status);
          setStep("connected");
          return;
        }
        if (status.state === "failed") {
          setError(
            "The speaker couldn't join that network. Check the password, " +
              "and that it's a 2.4GHz network.",
          );
          setStep("failed");
          return;
        }
        if (Date.now() > deadline) {
          setError("The speaker stopped responding while connecting.");
          setStep("failed");
          return;
        }
        again();
      })
      .catch(() => {
        // Dropped polls are normal while the radio switches networks.
        if (Date.now() > deadline) {
          setError("Lost contact with the speaker.");
          setStep("failed");
          return;
        }
        again();
      });
  }, []);

  const handleConnect = useCallback(async () => {
    setError(null);
    setStep("connecting");
    try {
      await requestWifiConnect(ssid.trim(), password);
      pollUntilSettled(Date.now() + CONNECT_TIMEOUT_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("failed");
    }
  }, [ssid, password, pollUntilSettled]);

  /** Clears the speaker's failed attempt and returns to the form. */
  const handleRetry = useCallback(async () => {
    setError(null);
    await resetAttempt().catch(() => {});
    setStep("credentials");
    void loadNetworks();
  }, [loadNetworks]);

  /** Full reset: drop the speaker's network and start from the beginning. */
  const handleStartOver = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    leaveSpeakerNetwork();
    setError(null);
    setDetails(null);
    setSpeakerSsid(null);
    setStep("find");
  }, []);

  const handlePair = useCallback(async () => {
    if (!details?.deviceId || !details.ip || !details.pin) return;
    // The speaker is on the real network now, so release ours and let it leave
    // setup mode. It may already be gone, so a failure here isn't fatal.
    void finishSetup().catch(() => {});
    leaveSpeakerNetwork();
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

      <View style={styles.statusCard}>
        <StatusBadge
          label={
            {
              find: "Looking for a speaker",
              credentials: "Speaker found",
              connecting: "Connecting",
              failed: "Connection failed",
              connected: "Connected",
            }[step]
          }
          tone={
            step === "connected"
              ? "success"
              : step === "failed"
                ? "error"
                : "neutral"
          }
        />
        {speakerSsid ? (
          <Text style={styles.statusMeta}>Speaker: {speakerSsid}</Text>
        ) : null}
      </View>

      {claimedByOther ? (
        <View style={styles.warningCard}>
          <View style={styles.cardHeaderRow}>
            <TriangleAlert size={18} color={colors.warning[700]} />
            <Text style={styles.warningTitle}>
              This speaker is already connected to another device.
            </Text>
          </View>
          <Text style={styles.cardText}>
            To use it with this phone, open the app on the phone that owns it
            and tap "Release speaker". Or press and hold the speaker's BOOT
            button for eight seconds to reset it completely.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === "find" && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Speaker size={18} color={colors.slate[600]} />
            <Text style={styles.cardTitle}>Find your speaker</Text>
          </View>
          <Text style={styles.cardText}>
            Power on the speaker. A new one announces that it's in setup mode
            and its light blinks quickly.
          </Text>

          {canJoinFromApp() ? (
            <>
              <Text style={styles.cardText}>
                Tap below and Android will list the speakers it can see. Pick
                yours — everything after that happens here in the app.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={handleJoinSpeaker}
                disabled={isJoining}
                accessibilityRole="button"
              >
                {isJoining ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Wifi size={18} color={colors.white} />
                    <Text style={styles.primaryButtonLabel}>
                      Find nearby speakers
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.cardText}>
                This phone's Android version needs you to join the speaker's
                network in Wi-Fi settings first. Look for a network named
                <Text style={styles.strong}> Speaker-Setup-…</Text>, then come
                back.
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={openWifiSettings}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonLabel}>
                  Open Wi-Fi settings
                </Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={handleManualJoin}
                disabled={isJoining}
                accessibilityRole="button"
              >
                {isJoining ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>
                    I've joined it — continue
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      )}

      {step === "credentials" && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Wifi size={18} color={colors.slate[600]} />
            <Text style={styles.cardTitle}>Your Wi-Fi details</Text>
            <Pressable
              onPress={loadNetworks}
              hitSlop={8}
              disabled={isScanning}
              accessibilityLabel="Rescan for networks"
            >
              <RefreshCw size={16} color={colors.primary[600]} />
            </Pressable>
          </View>

          {isScanning ? (
            <Text style={styles.cardText}>
              Asking the speaker what it can see…
            </Text>
          ) : networks.length > 0 ? (
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
          <Pressable style={styles.linkButton} onPress={handleStartOver}>
            <RotateCcw size={14} color={colors.slate[500]} />
            <Text style={styles.linkLabel}>Start over</Text>
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

      {step === "failed" && (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <TriangleAlert size={18} color={colors.error[600]} />
            <Text style={styles.cardTitle}>That didn't work</Text>
          </View>
          <Text style={styles.cardText}>
            Nothing is lost — the speaker is still in setup mode. Try again
            with the same or different details.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={handleRetry}
            accessibilityRole="button"
          >
            <RefreshCw size={18} color={colors.white} />
            <Text style={styles.primaryButtonLabel}>Retry</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={handleStartOver}>
            <RotateCcw size={14} color={colors.slate[500]} />
            <Text style={styles.linkLabel}>Start over from the beginning</Text>
          </Pressable>
        </View>
      )}

      {step === "connected" && details ? (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <CheckCircle2 size={20} color={colors.success[600]} />
            <Text style={styles.cardTitle}>Speaker is online</Text>
          </View>
          <View style={styles.detailsBox}>
            <Text style={styles.detailRow}>Device ID: {details.deviceId}</Text>
            <Text style={styles.detailRow}>IP address: {details.ip}</Text>
            <Text style={styles.detailRow}>PIN: {details.pin}</Text>
          </View>
          <Text style={styles.cardText}>
            Tap below to finish. Your phone returns to "{ssid}" and pairs with
            the speaker.
          </Text>
          {pairError ? <Text style={styles.errorText}>{pairError}</Text> : null}
          <Pressable
            style={styles.primaryButton}
            onPress={handlePair}
            disabled={isPairing}
            accessibilityRole="button"
          >
            {isPairing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonLabel}>Finish and pair</Text>
            )}
          </Pressable>
          {pairError ? (
            <Pressable style={styles.linkButton} onPress={handleStartOver}>
              <RotateCcw size={14} color={colors.slate[500]} />
              <Text style={styles.linkLabel}>Start over</Text>
            </Pressable>
          ) : null}
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
  statusCard: {
    marginHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  statusMeta: {
    fontSize: 12,
    color: colors.slate[500],
  },
  warningCard: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning[100],
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  warningTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.warning[700],
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  secondaryButtonLabel: {
    color: colors.primary[600],
    fontWeight: "600",
    fontSize: 14,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  linkLabel: {
    color: colors.slate[500],
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
    lineHeight: 18,
  },
});
