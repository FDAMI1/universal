import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Wrench,
} from "lucide-react-native";
import { useSettingsStore } from "@shared/store/useSettingsStore";
import ScreenHeader from "@shared/components/ScreenHeader";
import StatusBadge from "@shared/components/StatusBadge";
import {
  useAppPermissions,
  type PermissionItem,
} from "@modules/notifications/hooks/useAppPermissions";
import { colors, spacing, borderRadius } from "@shared/theme";

/**
 * One screen that grants everything the app needs to announce payments.
 *
 * Android has no single prompt for this: notification access and the OEM
 * autostart screens are settings pages, and only one can be open at a time.
 * So one button hands over the next missing permission, the list updates when
 * the user comes back, and the button carries on until nothing is left.
 */
function StepList({ steps }: { steps: string[] }) {
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

function PermissionRow({
  item,
  index,
  onPress,
}: {
  item: PermissionItem;
  index: number;
  onPress: () => void;
}) {
  // Open for anything outstanding, so the next thing to do is always on screen.
  const [showSteps, setShowSteps] = useState(!item.granted);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowHeader}
        onPress={() => setShowSteps((shown) => !shown)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.granted ? "Granted" : "Not granted"}. ${showSteps ? "Hide" : "Show"} steps.`}
      >
        <View style={styles.rowIcon}>
          {item.granted ? (
            <CheckCircle2 size={22} color={colors.success[600]} />
          ) : item.verifiable ? (
            <Circle size={22} color={colors.slate[300]} />
          ) : (
            <CircleAlert size={22} color={colors.warning[600]} />
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>
            {index + 1}. {item.title}
          </Text>
          <Text style={styles.rowWhy}>{item.why}</Text>
        </View>
        {showSteps ? (
          <ChevronDown size={18} color={colors.slate[400]} />
        ) : (
          <ChevronRight size={18} color={colors.slate[400]} />
        )}
      </Pressable>

      {showSteps ? (
        <>
          <StepList steps={item.steps} />
          <Pressable
            style={styles.openButton}
            onPress={onPress}
            accessibilityRole="button"
          >
            <Text style={styles.openButtonLabel}>
              {item.granted ? "Open it again" : `Open ${item.title}`}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** Both ways of finding out why a payment was not announced, written out. */
function TroubleshootingCard() {
  const verboseLogging = useSettingsStore((s) => s.verboseLogging);
  const setVerboseLogging = useSettingsStore((s) => s.setVerboseLogging);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Wrench size={18} color={colors.slate[600]} />
        <Text style={styles.cardTitle}>A payment wasn't announced?</Text>
      </View>
      <Text style={styles.cardText}>
        This shows the exact words your payment app used, which is what's
        needed to make it work.
      </Text>

      <StepList
        steps={[
          "Turn on the switch below.",
          "Receive a payment, even ₹1.",
          "Open the Logs tab. Every notification your phone showed is listed, with its wording and why it was ignored.",
          "Screenshot that and send it on.",
          "Turn the switch off afterwards — it fills the log quickly.",
        ]}
      />

      <View style={styles.captureRow}>
        <Text style={styles.rowTitle}>Capture every notification</Text>
        <Switch
          value={verboseLogging}
          onValueChange={setVerboseLogging}
          trackColor={{ true: colors.primary[500], false: colors.slate[200] }}
        />
      </View>

      <Text style={styles.subheading}>Letting a developer read the log</Text>
      <Text style={styles.cardText}>
        Only needed if the steps above don't explain it. Nothing is sent
        anywhere; it lets a computer you plug into read this phone's own log.
      </Text>
      <StepList
        steps={[
          "Settings → About phone.",
          "Tap the version row seven times, until it says you are now a developer. It is called OS version on Xiaomi HyperOS, MIUI version on older Xiaomi phones, and Build number on most others.",
          "Go back → Additional settings → Developer options. On some phones it sits at the bottom of the main Settings list instead.",
          "Turn on USB debugging.",
          "Plug the phone into the computer using a cable that carries data, not a charge-only one.",
          "Tap Allow on the \"Allow USB debugging?\" prompt that appears on the phone.",
        ]}
      />
    </View>
  );
}

export default function NotificationAccessScreen() {
  const insets = useSafeAreaInsets();
  const {
    items,
    isWorking,
    requestNext,
    requestOne,
    grantedCount,
    requiredCount,
    allRequiredGranted,
    nextPending,
  } = useAppPermissions();

  if (Platform.OS !== "android") {
    return (
      <View style={styles.container}>
        <ScreenHeader title="App access" />
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Reading payment notifications is only possible on Android.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing["3xl"] },
      ]}
    >
      <ScreenHeader
        title="App access"
        subtitle="What the app needs to announce your payments"
      />

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <ShieldCheck
            size={20}
            color={allRequiredGranted ? colors.success[600] : colors.warning[600]}
          />
          <Text style={styles.cardTitle}>
            {allRequiredGranted ? "All set" : "Setup needed"}
          </Text>
        </View>
        <StatusBadge
          label={`${grantedCount} of ${requiredCount} granted`}
          tone={allRequiredGranted ? "success" : "warning"}
        />
        <Text style={styles.cardText}>
          {allRequiredGranted
            ? "Payments received in your UPI apps will be announced on your speaker."
            : "Tap the button below. It opens each permission in turn — grant it, " +
              "press Back, and tap again for the next one."}
        </Text>
      </View>

      <Pressable
        style={[styles.grantButton, allRequiredGranted && styles.grantButtonDone]}
        onPress={requestNext}
        disabled={isWorking || !nextPending}
        accessibilityRole="button"
      >
        {isWorking ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.grantButtonLabel}>
            {nextPending
              ? `Grant access: ${nextPending.title}`
              : "Everything is granted"}
          </Text>
        )}
      </Pressable>

      <View style={styles.card}>
        {items.map((item, index) => (
          <PermissionRow
            key={item.key}
            item={item}
            index={index}
            onPress={() => void requestOne(item.key)}
          />
        ))}
      </View>

      <TroubleshootingCard />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Why each one is needed</Text>
        <Text style={styles.cardText}>
          The app reads notifications only from the payment apps you switch on
          in Settings, takes the amount from them, and sends it to your own
          speaker over your Wi-Fi. Nothing is sent anywhere else, and the app
          never sees your bank login or your money.
        </Text>
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
    lineHeight: 19,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  steps: {
    gap: spacing.sm,
    paddingLeft: spacing.xl,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 18,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary[600],
    textAlign: "right",
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: colors.slate[600],
    lineHeight: 19,
  },
  openButton: {
    alignSelf: "flex-start",
    marginLeft: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  openButtonLabel: {
    color: colors.primary[700],
    fontWeight: "600",
    fontSize: 13,
  },
  captureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  subheading: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate[800],
  },
  rowIcon: {
    paddingTop: 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate[800],
  },
  rowWhy: {
    fontSize: 12,
    color: colors.slate[500],
    lineHeight: 17,
  },
  grantButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  grantButtonDone: {
    backgroundColor: colors.success[600],
  },
  grantButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
});
