import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, TextInput } from "react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import {
  useSettingsStore,
  ToggleableSource,
  GooglePayMode,
} from "@shared/store/useSettingsStore";
import {
  parseMinimumAmountInput,
  parseDuplicateTimeoutInput,
} from "@modules/settings/settingsInputParsing";
import { colors, spacing, borderRadius, formatCurrency } from "@shared/theme";

const SOURCE_LABELS: Record<ToggleableSource, string> = {
  phonepe_business: "PhonePe Business",
  paytm_business: "Paytm Business",
  google_pay: "Google Pay",
};

const VOLUME_STEPS = [0.25, 0.5, 0.75, 1] as const;

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "Hindi" },
];

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SourceManagementSection() {
  const enabledSources = useSettingsStore((s) => s.enabledSources);
  const googlePayMode = useSettingsStore((s) => s.googlePayMode);
  const smsEnabled = useSettingsStore((s) => s.smsEnabled);
  const smsPackageName = useSettingsStore((s) => s.smsPackageName);
  const setSourceEnabled = useSettingsStore((s) => s.setSourceEnabled);
  const setGooglePayMode = useSettingsStore((s) => s.setGooglePayMode);
  const setSmsEnabled = useSettingsStore((s) => s.setSmsEnabled);
  const setSmsPackageName = useSettingsStore((s) => s.setSmsPackageName);

  const sources = Object.keys(SOURCE_LABELS) as ToggleableSource[];

  return (
    <View style={styles.section}>
      <SectionTitle>Source Management</SectionTitle>
      <View style={styles.card}>
        {sources.map((source, index) => (
          <View key={source} style={[styles.row, index < sources.length - 1 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{SOURCE_LABELS[source]}</Text>
            <Switch
              value={enabledSources[source]}
              onValueChange={(value) => setSourceEnabled(source, value)}
              trackColor={{ true: colors.primary[500], false: colors.slate[200] }}
            />
          </View>
        ))}
      </View>

      {enabledSources.google_pay && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Google Pay account type</Text>
          <View style={styles.segmentedControl}>
            {(["business", "personal"] as GooglePayMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.segment, googlePayMode === mode && styles.segmentActive]}
                onPress={() => setGooglePayMode(mode)}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    googlePayMode === mode && styles.segmentLabelActive,
                  ]}
                >
                  {mode === "business" ? "Business" : "Personal"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Bank SMS (optional)</Text>
          <Switch
            value={smsEnabled}
            onValueChange={setSmsEnabled}
            trackColor={{ true: colors.primary[500], false: colors.slate[200] }}
          />
        </View>
        {smsEnabled && (
          <View style={styles.rowDivider}>
            <Text style={styles.cardLabel}>SMS app package name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. com.google.android.apps.messaging"
              value={smsPackageName}
              onChangeText={setSmsPackageName}
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>
              Varies by phone manufacturer — find it in your SMS app's system settings entry.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function AnnouncementSettingsSection() {
  const language = useSettingsStore((s) => s.language);
  const volume = useSettingsStore((s) => s.volume);
  const minimumAmount = useSettingsStore((s) => s.minimumAmount);
  const duplicateTimeoutSeconds = useSettingsStore((s) => s.duplicateTimeoutSeconds);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setMinimumAmount = useSettingsStore((s) => s.setMinimumAmount);
  const setDuplicateTimeout = useSettingsStore((s) => s.setDuplicateTimeout);

  const [minAmountInput, setMinAmountInput] = useState(String(minimumAmount / 100));
  const [timeoutInput, setTimeoutInput] = useState(String(duplicateTimeoutSeconds));

  return (
    <View style={styles.section}>
      <SectionTitle>Announcement Settings</SectionTitle>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Language</Text>
        <View style={styles.segmentedControl}>
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              style={[styles.segment, language === lang.code && styles.segmentActive]}
              onPress={() => setLanguage(lang.code)}
            >
              <Text
                style={[styles.segmentLabel, language === lang.code && styles.segmentLabelActive]}
              >
                {lang.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Volume</Text>
        <View style={styles.segmentedControl}>
          {VOLUME_STEPS.map((step) => (
            <Pressable
              key={step}
              style={[styles.segment, volume === step && styles.segmentActive]}
              onPress={() => setVolume(step)}
            >
              <Text style={[styles.segmentLabel, volume === step && styles.segmentLabelActive]}>
                {Math.round(step * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Minimum payment amount</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>₹</Text>
          <TextInput
            style={styles.inlineInput}
            value={minAmountInput}
            onChangeText={setMinAmountInput}
            onEndEditing={() => {
              const paise = parseMinimumAmountInput(minAmountInput);
              setMinimumAmount(paise);
              setMinAmountInput(String(paise / 100));
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <Text style={styles.helperText}>
          Payments below this amount won't trigger an announcement. Currently{" "}
          {formatCurrency(minimumAmount)}.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Duplicate timeout</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inlineInput}
            value={timeoutInput}
            onChangeText={setTimeoutInput}
            onEndEditing={() => {
              const clamped = parseDuplicateTimeoutInput(timeoutInput);
              setDuplicateTimeout(clamped);
              setTimeoutInput(String(clamped));
            }}
            keyboardType="number-pad"
          />
          <Text style={styles.inputSuffix}>seconds</Text>
        </View>
        <Text style={styles.helperText}>
          Repeated notifications for the same payment within this window are ignored.
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader title="Settings" subtitle="Sources & announcements" />
      <SourceManagementSection />
      <AnnouncementSettingsSection />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  content: {
    paddingBottom: spacing["3xl"],
  },
  section: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate[500],
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.slate[100],
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.slate[800],
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate[700],
  },
  helperText: {
    fontSize: 12,
    color: colors.slate[500],
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.slate[100],
    borderRadius: borderRadius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentLabel: {
    fontSize: 13,
    color: colors.slate[500],
    fontWeight: "500",
  },
  segmentLabelActive: {
    color: colors.primary[700],
    fontWeight: "700",
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  inputPrefix: {
    fontSize: 14,
    color: colors.slate[600],
  },
  inputSuffix: {
    fontSize: 13,
    color: colors.slate[500],
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.slate[800],
    minWidth: 80,
  },
});
