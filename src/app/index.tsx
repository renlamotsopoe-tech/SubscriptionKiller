import { detectSubscriptionCandidate } from "@/utils/subscription-detection";
import {
  createSubscriptionRecords,
  type SubscriptionRecord,
} from "@/utils/subscription-records";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const GOOGLE_WEB_CLIENT_ID =
  "70683543777-mso9f2hl8j75joc0noqbjplm8k43kipm.apps.googleusercontent.com";

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

export default function HomeScreen() {
  const [subscriptionRecords, setSubscriptionRecords] = useState<
    SubscriptionRecord[]
  >([]);
  const dashboardTotals = getDashboardTotals(subscriptionRecords);
  const decisionCounts = getDecisionCounts(subscriptionRecords);

  const handleScan = async () => {
    try {
      await GoogleSignin.hasPlayServices();

      const signInResponse = await GoogleSignin.signIn();

      if (signInResponse.type !== "success") {
        return;
      }

      await GoogleSignin.addScopes({
        scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      });

      const tokens = await GoogleSignin.getTokens();

      const gmailResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
          new URLSearchParams({
            q: "{subscription receipt payment}",
            maxResults: "20",
          }).toString(),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        },
      );

      if (!gmailResponse.ok) {
        throw new Error(`Gmail API error: ${gmailResponse.status}`);
      }

      const gmailData = await gmailResponse.json();

      const messages = gmailData.messages ?? [];

      const emailDetails = [];

      for (const message of messages) {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          },
        );

        if (!messageResponse.ok) {
          continue;
        }

        const messageData = await messageResponse.json();

        const headers = messageData.payload?.headers ?? [];

        const subject =
          headers.find((header: any) => header.name === "Subject")?.value ?? "";

        const sender =
          headers.find((header: any) => header.name === "From")?.value ?? "";

        emailDetails.push({
          id: message.id,
          subject,
          sender,
          snippet: messageData.snippet ?? "",
        });
      }

      const detectedCandidates = emailDetails
        .map((email) => detectSubscriptionCandidate(email))
        .filter((candidate) => candidate.isSubscriptionCandidate);
      const records = createSubscriptionRecords(detectedCandidates);

      setSubscriptionRecords(records);

      const recordSummaries = records.map((candidate) => {
        const amount =
          candidate.amount !== null && candidate.currency !== null
            ? formatCandidateAmount(candidate.amount, candidate.currency)
            : "amount unknown";
        const frequency = candidate.billingFrequency ?? "frequency unknown";

        return `${candidate.merchant} — ${amount} — ${frequency}`;
      });

      Alert.alert(
        "Subscription Detection Complete",
        [
          `Emails retrieved: ${emailDetails.length}`,
          `Candidates: ${detectedCandidates.length}`,
          `Subscriptions: ${records.length}`,
          recordSummaries.length > 0
            ? recordSummaries.join("\n")
            : "None detected",
        ].join("\n"),
      );
    } catch (error) {
      console.error("Gmail Scan Error:", error);

      Alert.alert(
        "Gmail Scan Failed",
        "We couldn't read your Gmail messages. Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>SubscriptionKiller</Text>
            <Text style={styles.tagline}>
              Stop paying for things you forgot.
            </Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>SK</Text>
          </View>
        </View>

        {/* MAIN SPENDING CARD */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>YOUR SUBSCRIPTIONS</Text>

          <Text style={styles.monthlyAmount}>
            {dashboardTotals.monthlyCost !== null && dashboardTotals.currency
              ? formatCandidateAmount(
                  dashboardTotals.monthlyCost,
                  dashboardTotals.currency,
                )
              : subscriptionRecords.length > 0
                ? "Amount unknown"
                : "No scan yet"}
          </Text>

          <Text style={styles.perMonth}>
            {dashboardTotals.monthlyCost !== null
              ? "per month"
              : subscriptionRecords.length > 0
                ? "some costs are unavailable"
                : "scan Gmail to calculate"}
          </Text>

          <View style={styles.divider} />

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.smallLabel}>YEARLY COST</Text>
              <Text style={styles.yearlyAmount}>
                {dashboardTotals.yearlyCost !== null && dashboardTotals.currency
                  ? formatCandidateAmount(
                      dashboardTotals.yearlyCost,
                      dashboardTotals.currency,
                    )
                  : "Amount unknown"}
              </Text>
            </View>

            <View style={styles.subscriptionCount}>
              <Text style={styles.countNumber}>{subscriptionRecords.length}</Text>
              <Text style={styles.countLabel}>found</Text>
            </View>
          </View>
        </View>

        {/* SCAN BUTTON */}
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            pressed && styles.pressed,
          ]}
          onPress={handleScan}
        >
          <View style={styles.scanIcon}>
            <Text style={styles.scanIconText}>⌕</Text>
          </View>

          <View style={styles.scanTextContainer}>
            <Text style={styles.scanTitle}>Find my subscriptions</Text>
            <Text style={styles.scanSubtitle}>
              Scan your email for recurring payments
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        {/* QUICK STATS */}
        <Text style={styles.sectionTitle}>Your money</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✓</Text>
            <Text style={styles.statNumber}>{decisionCounts.KEEP}</Text>
            <Text style={styles.statLabel}>Keep</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>?</Text>
            <Text style={styles.statNumber}>{decisionCounts.REVIEW}</Text>
            <Text style={styles.statLabel}>Review</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>×</Text>
            <Text style={styles.statNumber}>{decisionCounts.KILL}</Text>
            <Text style={styles.statLabel}>Kill</Text>
          </View>
        </View>

        {/* RECENT SUBSCRIPTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Subscriptions</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>

        {subscriptionRecords.length > 0 ? (
          subscriptionRecords.map((record) => {
            const name = record.productName ?? record.merchant;

            return (
              <SubscriptionRow
                key={record.id}
                name={name}
                category={record.category}
                price={formatRecordAmount(record)}
                frequency={formatRecordFrequency(record.billingFrequency)}
                status={record.decision}
                icon={name.charAt(0).toUpperCase() || "?"}
              />
            );
          })
        ) : (
          <Text style={styles.tipText}>
            No subscription records yet. Scan Gmail to find them.
          </Text>
        )}

        {/* BOTTOM MESSAGE */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>
            {decisionCounts.KILL > 0
              ? `${decisionCounts.KILL} subscription${decisionCounts.KILL === 1 ? "" : "s"} may be ending`
              : "Review your detected subscriptions"}
          </Text>
          <Text style={styles.tipText}>
            Recommendations use email evidence only and should be reviewed before
            taking action.
          </Text>

          <Pressable
            onPress={() =>
              Alert.alert(
                "Coming next",
                "Cancellation assistance will be added after subscription detection.",
              )
            }
          >
            <Text style={styles.tipAction}>Review it →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCandidateAmount(
  amount: number,
  currency: "INR" | "USD" | "EUR" | "GBP",
): string {
  const symbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency];
  const formattedAmount = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${symbol}${formattedAmount}`;
}

function formatRecordAmount(record: SubscriptionRecord): string {
  if (record.amount === null || record.currency === null) {
    return "Amount unknown";
  }

  return formatCandidateAmount(record.amount, record.currency);
}

function formatRecordFrequency(
  frequency: SubscriptionRecord["billingFrequency"],
): string {
  if (frequency === null) return "frequency unknown";

  return {
    weekly: "/week",
    monthly: "/month",
    quarterly: "/quarter",
    yearly: "/year",
  }[frequency];
}

function getDashboardTotals(records: SubscriptionRecord[]): {
  monthlyCost: number | null;
  yearlyCost: number | null;
  currency: SubscriptionRecord["currency"];
} {
  if (
    records.length === 0 ||
    records.some(
      (record) => record.monthlyCost === null || record.yearlyCost === null || record.currency === null,
    )
  ) {
    return { monthlyCost: null, yearlyCost: null, currency: null };
  }

  const currency = records[0].currency;
  if (!currency || records.some((record) => record.currency !== currency)) {
    return { monthlyCost: null, yearlyCost: null, currency: null };
  }

  return {
    monthlyCost: records.reduce((total, record) => total + (record.monthlyCost ?? 0), 0),
    yearlyCost: records.reduce((total, record) => total + (record.yearlyCost ?? 0), 0),
    currency,
  };
}

function getDecisionCounts(records: SubscriptionRecord[]): Record<"KEEP" | "REVIEW" | "KILL", number> {
  return records.reduce(
    (counts, record) => {
      counts[record.decision] += 1;
      return counts;
    },
    { KEEP: 0, REVIEW: 0, KILL: 0 },
  );
}

function SubscriptionRow({
  name,
  category,
  price,
  frequency,
  status,
  icon,
}: {
  name: string;
  category: string;
  price: string;
  frequency: string;
  status: "KEEP" | "REVIEW" | "KILL";
  icon: string;
}) {
  return (
    <View style={styles.subscriptionRow}>
      <View style={styles.serviceIcon}>
        <Text style={styles.serviceIconText}>{icon}</Text>
      </View>

      <View style={styles.subscriptionInfo}>
        <Text style={styles.serviceName}>{name}</Text>
        <Text style={styles.serviceCategory}>{category}</Text>
      </View>

      <View style={styles.priceContainer}>
        <Text style={styles.servicePrice}>{price}</Text>
        <Text style={styles.frequency}>{frequency}</Text>
      </View>

      <View
        style={[
          styles.statusPill,
          status === "KEEP" && styles.keepPill,
          status === "REVIEW" && styles.reviewPill,
          status === "KILL" && styles.killPill,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            status === "KEEP" && styles.keepText,
            status === "REVIEW" && styles.reviewText,
            status === "KILL" && styles.killText,
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0B0D10",
  },

  container: {
    flex: 1,
    backgroundColor: "#0B0D10",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 24,
  },

  brand: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  tagline: {
    color: "#8F96A3",
    fontSize: 13,
    marginTop: 4,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    color: "#0B0D10",
    fontSize: 13,
    fontWeight: "800",
  },

  /* HERO */

  heroCard: {
    backgroundColor: "#15181D",
    borderRadius: 24,
    padding: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#242831",
  },

  heroLabel: {
    color: "#8F96A3",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  monthlyAmount: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "800",
    marginTop: 10,
    letterSpacing: -1.5,
  },

  perMonth: {
    color: "#8F96A3",
    fontSize: 14,
    marginTop: -2,
  },

  divider: {
    height: 1,
    backgroundColor: "#292D35",
    marginVertical: 20,
  },

  heroBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  smallLabel: {
    color: "#777E8B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  yearlyAmount: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },

  subscriptionCount: {
    alignItems: "flex-end",
  },

  countNumber: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },

  countLabel: {
    color: "#777E8B",
    fontSize: 11,
    marginTop: -2,
  },

  /* SCAN */

  scanButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  scanIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#111318",
    justifyContent: "center",
    alignItems: "center",
  },

  scanIconText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
  },

  scanTextContainer: {
    flex: 1,
    marginLeft: 13,
  },

  scanTitle: {
    color: "#111318",
    fontSize: 16,
    fontWeight: "800",
  },

  scanSubtitle: {
    color: "#777E8B",
    fontSize: 11,
    marginTop: 3,
  },

  arrow: {
    color: "#111318",
    fontSize: 30,
    fontWeight: "300",
    marginLeft: 8,
  },

  /* SECTIONS */

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 12,
  },

  seeAll: {
    color: "#8F96A3",
    fontSize: 13,
    fontWeight: "600",
  },

  /* STATS */

  statsRow: {
    flexDirection: "row",
    gap: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#15181D",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#242831",
  },

  statIcon: {
    color: "#8F96A3",
    fontSize: 16,
    fontWeight: "800",
  },

  statNumber: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 8,
  },

  statLabel: {
    color: "#777E8B",
    fontSize: 11,
    marginTop: 2,
  },

  /* SUBSCRIPTIONS */

  subscriptionRow: {
    backgroundColor: "#15181D",
    borderRadius: 18,
    padding: 14,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#242831",
  },

  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#242831",
    justifyContent: "center",
    alignItems: "center",
  },

  serviceIconText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  subscriptionInfo: {
    flex: 1,
    marginLeft: 11,
  },

  serviceName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  serviceCategory: {
    color: "#777E8B",
    fontSize: 10,
    marginTop: 3,
  },

  priceContainer: {
    alignItems: "flex-end",
    marginRight: 9,
  },

  servicePrice: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  frequency: {
    color: "#777E8B",
    fontSize: 9,
    marginTop: 2,
  },

  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },

  keepPill: {
    backgroundColor: "#193322",
  },

  reviewPill: {
    backgroundColor: "#332D18",
  },

  killPill: {
    backgroundColor: "#351D20",
  },

  statusText: {
    fontSize: 8,
    fontWeight: "800",
  },

  keepText: {
    color: "#7EE2A8",
  },

  reviewText: {
    color: "#E7C76A",
  },

  killText: {
    color: "#F28B8B",
  },

  /* TIP */

  tipCard: {
    backgroundColor: "#15181D",
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#242831",
  },

  tipTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  tipText: {
    color: "#8F96A3",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  tipAction: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 14,
  },
});
