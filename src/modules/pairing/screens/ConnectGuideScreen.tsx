import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@navigation/AppNavigator";
import { Wifi, KeyRound, Radio, CircleHelp } from "lucide-react-native";
import ScreenHeader from "@shared/components/ScreenHeader";
import { colors, spacing, borderRadius } from "@shared/theme";

/** Plain-language walkthrough of how the phone and the speaker find each
 * other. Reached from the Dashboard (while nothing is paired) and from
 * Settings. Kept as content only — the actual setup lives in
 * SpeakerWifiSetupScreen, which this screen links to. */

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
  return (
    <View style={styles.card}>
      <View style={styles.stepHeaderRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeLabel}>{number}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bodyText}>{children}</Text>;
}

export default function ConnectGuideScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing["3xl"] },
      ]}
    >
      <ScreenHeader
        title="Connecting your speaker"
        subtitle="How the phone and the sound box find each other"
      />

      <View style={[styles.card, styles.introCard]}>
        <View style={styles.cardHeaderRow}>
          <CircleHelp size={18} color={colors.primary[600]} />
          <Text style={styles.cardTitle}>The short version</Text>
        </View>
        <Body>
          Both devices join the same Wi-Fi. You type the speaker's PIN once to
          prove the speaker is yours, and it remembers your phone from then on.
          There is no internet service in between — your phone talks to the
          speaker directly, so announcements keep working even if your
          broadband is down.
        </Body>
      </View>

      <Step number={1} title="Put the speaker on your Wi-Fi">
        <Body>
          A brand-new speaker has no Wi-Fi, so it makes its own network called
          <Text style={styles.strong}> Speaker-Setup-…</Text> and says so
          aloud. In this app, tap{" "}
          <Text style={styles.strong}>Set up a speaker now</Text> below:
          Android lists the speakers it can see, you pick yours, and then you
          type your Wi-Fi name and password right here. The speaker restarts
          onto your Wi-Fi.
        </Body>
        <Body>
          Your Wi-Fi must be 2.4GHz. Almost every home router and phone hotspot
          provides one.
        </Body>
      </Step>

      <Step number={2} title="Note the three values">
        <Body>
          Once it's online, the speaker reads out and displays three things:
        </Body>
        <View style={styles.valueList}>
          <Text style={styles.valueRow}>
            <Text style={styles.strong}>Device ID</Text> — its permanent name,
            like SPK-1BA0A4
          </Text>
          <Text style={styles.valueRow}>
            <Text style={styles.strong}>IP address</Text> — where it lives on
            your Wi-Fi, like 192.168.1.50
          </Text>
          <Text style={styles.valueRow}>
            <Text style={styles.strong}>PIN</Text> — six digits that prove
            you're the owner
          </Text>
        </View>
        <Body>
          The setup screen in this app fills these in for you, so you normally
          never type them.
        </Body>
      </Step>

      <Step number={3} title="Pair the two">
        <Body>
          Switch your phone back to your normal Wi-Fi, then pair. The app sends
          the PIN along with a secret key it creates for your phone. The
          speaker checks the PIN, saves that key, and confirms out loud.
        </Body>
        <Body>
          From then on the speaker only accepts messages carrying your phone's
          key, so no other phone on your Wi-Fi can make it speak.
        </Body>
      </Step>

      <Step number={4} title="Test it">
        <Body>
          Use <Text style={styles.strong}>Test Speaker</Text> on the Dashboard.
          If you hear the announcement, you're done — real payments will be
          announced automatically once notification access is on.
        </Body>
      </Step>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Radio size={18} color={colors.slate[600]} />
          <Text style={styles.cardTitle}>If it stops connecting</Text>
        </View>
        <Body>
          <Text style={styles.strong}>Both must be on the same Wi-Fi.</Text> If
          your phone is on mobile data or a guest network, it cannot reach the
          speaker.
        </Body>
        <Body>
          <Text style={styles.strong}>The address can change.</Text> After a
          power cut your router may give the speaker a new IP. Press the
          speaker's BOOT button once — it reads the new address aloud — then
          pair again. To stop this happening, reserve the speaker's address in
          your router settings.
        </Body>
        <Body>
          <Text style={styles.strong}>Starting over.</Text> Holding BOOT for
          eight seconds makes the speaker forget its Wi-Fi and your phone, so
          you can set it up fresh.
        </Body>
        <Body>
          <Text style={styles.strong}>Someone else's speaker.</Text> A speaker
          only answers to the phone that claimed it. If the app says it's
          already connected to another device, release it from that phone
          (Speaker tab → Release speaker) and it becomes available again.
        </Body>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <KeyRound size={18} color={colors.slate[600]} />
          <Text style={styles.cardTitle}>Buttons and light</Text>
        </View>
        <Body>
          <Text style={styles.strong}>Short press BOOT</Text> — reads out the
          address and PIN, and lets a new phone pair for three minutes.
        </Body>
        <Body>
          <Text style={styles.strong}>The blue light</Text> — blinking fast
          means setup mode, slow means waiting for your phone, steady means
          connected.
        </Body>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate("SpeakerWifiSetup")}
        accessibilityRole="button"
      >
        <Wifi size={18} color={colors.white} />
        <Text style={styles.primaryButtonLabel}>Set up a speaker now</Text>
      </Pressable>
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
  introCard: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[600],
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.slate[800],
    flex: 1,
  },
  bodyText: {
    fontSize: 13,
    color: colors.slate[600],
    lineHeight: 20,
  },
  strong: {
    fontWeight: "700",
    color: colors.slate[800],
  },
  valueList: {
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  valueRow: {
    fontSize: 13,
    color: colors.slate[600],
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  primaryButtonLabel: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
});
