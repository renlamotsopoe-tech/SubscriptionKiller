import { detectSubscriptionCandidate } from "@/utils/subscription-detection";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
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

      Alert.alert(
        "Subscription Detection Complete",
        [
          `Emails retrieved: ${emailDetails.length}`,
          `Subscription candidates: ${detectedCandidates.length}`,
          `Merchants: ${
            detectedCandidates.length > 0
              ? detectedCandidates
                  .map((candidate) => candidate.merchant)
                  .join(", ")
              : "None detected"
          }`,
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

          <Text style={styles.monthlyAmount}>₹2,847</Text>

          <Text style={styles.perMonth}>per month</Text>

          <View style={styles.divider} />

          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.smallLabel}>YEARLY COST</Text>
              <Text style={styles.yearlyAmount}>₹34,164</Text>
            </View>

            <View style={styles.subscriptionCount}>
              <Text style={styles.countNumber}>7</Text>
              <Text style={styles.countLabel}>active</Text>
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
            <Text style={styles.statNumber}>4</Text>
            <Text style={styles.statLabel}>Keep</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>?</Text>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Review</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>×</Text>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Kill</Text>
          </View>
        </View>

        {/* RECENT SUBSCRIPTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Subscriptions</Text>
          <Text style={styles.seeAll}>See all</Text>
        </View>

        <SubscriptionRow
          name="Netflix"
          category="Entertainment"
          price="₹649"
          frequency="/month"
          status="KEEP"
          icon="N"
        />

        <SubscriptionRow
          name="Spotify"
          category="Music"
          price="₹119"
          frequency="/month"
          status="KEEP"
          icon="S"
        />

        <SubscriptionRow
          name="Adobe Creative Cloud"
          category="Software"
          price="₹1,675"
          frequency="/month"
          status="REVIEW"
          icon="A"
        />

        <SubscriptionRow
          name="Unused App"
          category="Other"
          price="₹404"
          frequency="/month"
          status="KILL"
          icon="?"
        />

        {/* BOTTOM MESSAGE */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>You could save ₹404/month</Text>
          <Text style={styles.tipText}>
            One subscription looks unused. That's ₹4,848 you could keep this
            year.
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
