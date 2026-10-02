import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  ShieldCheck,
} from "lucide-react-native";
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
function PermissionRow({
  item,
  onPress,
}: {
  item: PermissionItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.granted ? "Granted" : "Not granted"}. Tap to open.`}
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
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowWhy}>{item.why}</Text>
        {!item.granted ? (
          <Text style={styles.rowInstruction}>
            When the settings screen opens: {item.instruction}
          </Text>
        ) : null}
        {!item.verifiable ? (
          <Text style={styles.rowNote}>
            Android can't report this one, so it always shows as unconfirmed.
            Open it once and you're done.
          </Text>
        ) : null}
      </View>
    </Pressable>
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
        {items.map((item) => (
          <PermissionRow
            key={item.key}
            item={item}
            onPress={() => void requestOne(item.key)}
          />
        ))}
      </View>

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
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
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
  rowInstruction: {
    fontSize: 12,
    color: colors.primary[700],
    lineHeight: 17,
    marginTop: 2,
  },
  rowNote: {
    fontSize: 12,
    color: colors.warning[700],
    lineHeight: 17,
    marginTop: 2,
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
