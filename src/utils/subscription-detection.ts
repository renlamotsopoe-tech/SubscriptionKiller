export type GmailEmail = {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
};

export type SubscriptionCandidate = {
  emailId: string;
  merchant: string;
  confidence: number;
  evidence: string[];
  isSubscriptionCandidate: boolean;
  normalizedSender: string;
  senderDomain: string;
};

const SUBSCRIPTION_SIGNALS = [
  "subscription",
  "subscribed",
  "renewal",
  "renewed",
  "recurring",
  "billing",
  "payment",
  "receipt",
  "invoice",
  "membership",
  "plan",
  "trial",
  "monthly",
  "annual",
  "yearly",
] as const;

const GENERIC_SENDER_NAMES = new Set([
  "billing",
  "customer support",
  "email",
  "info",
  "no reply",
  "noreply",
  "notifications",
  "support",
]);

const GENERIC_SUBDOMAINS = new Set([
  "billing",
  "email",
  "mail",
  "mailer",
  "messages",
  "news",
  "no-reply",
  "noreply",
  "notification",
  "notifications",
  "support",
]);

const SECOND_LEVEL_DOMAINS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

export function detectSubscriptionCandidate(email: GmailEmail): SubscriptionCandidate {
  const normalizedSender = extractSenderAddress(email.sender);
  const senderDomain = getSenderDomain(normalizedSender);
  const merchant = getMerchantName(email.sender, senderDomain);
  const evidence = findEvidence(email);
  const confidence = calculateConfidence(evidence, merchant);

  return {
    emailId: email.id,
    merchant,
    confidence,
    evidence,
    isSubscriptionCandidate: confidence >= 25,
    normalizedSender,
    senderDomain,
  };
}

function extractSenderAddress(sender: string): string {
  const emailMatch = sender.match(/<\s*([^>\s]+@[^>\s]+)\s*>|\b([^\s<>]+@[^\s<>]+)\b/i);
  return (emailMatch?.[1] ?? emailMatch?.[2] ?? sender).trim().toLowerCase();
}

function getSenderDomain(senderAddress: string): string {
  const atIndex = senderAddress.lastIndexOf("@");
  return atIndex === -1 ? "" : senderAddress.slice(atIndex + 1).toLowerCase();
}

function getMerchantName(sender: string, senderDomain: string): string {
  const displayName = sender.replace(/<[^>]*>/g, "").replace(/[\"']/g, "").trim();
  const normalizedDisplayName = displayName.toLowerCase();

  if (
    displayName &&
    !displayName.includes("@") &&
    !GENERIC_SENDER_NAMES.has(normalizedDisplayName)
  ) {
    return displayName;
  }

  if (!senderDomain) {
    return "Unknown merchant";
  }

  const domainParts = senderDomain.split(".");
  const suffixLength =
    domainParts.length >= 3 && SECOND_LEVEL_DOMAINS.has(domainParts.at(-2) ?? "")
      ? 2
      : 1;
  const merchantPart = domainParts.at(-(suffixLength + 1)) ?? senderDomain;
  const merchantParts = merchantPart.split("-").filter((part) => !GENERIC_SUBDOMAINS.has(part));

  return merchantParts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown merchant";
}

function findEvidence(email: GmailEmail): string[] {
  const fields = [
    ["subject", email.subject],
    ["sender", email.sender],
    ["snippet", email.snippet],
  ] as const;

  return fields.flatMap(([fieldName, value]) => {
    const searchableValue = value.toLowerCase();

    return SUBSCRIPTION_SIGNALS.filter((signal) => searchableValue.includes(signal)).map(
      (signal) => `${fieldName} contains "${signal}"`,
    );
  });
}

function calculateConfidence(evidence: string[], merchant: string): number {
  const subjectSignals = evidence.filter((item) => item.startsWith("subject")).length;
  const senderSignals = evidence.filter((item) => item.startsWith("sender")).length;
  const snippetSignals = evidence.filter((item) => item.startsWith("snippet")).length;
  const merchantBonus = merchant === "Unknown merchant" ? 0 : 5;

  const score =
    subjectSignals * 20 + senderSignals * 10 + snippetSignals * 8 + merchantBonus;

  return Math.min(score, 100);
}
