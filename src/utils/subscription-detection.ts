export type GmailEmail = {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
};

export type Currency = "INR" | "USD" | "EUR" | "GBP";
export type BillingFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "ending"
  | "expired"
  | "trial"
  | "unknown";

export type SubscriptionCandidate = {
  emailId: string;
  merchant: string;
  productName: string | null;
  amount: number | null;
  currency: Currency | null;
  billingFrequency: BillingFrequency | null;
  paymentDate: string | null;
  status: SubscriptionStatus;
  trial: boolean | null;
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

const SECOND_LEVEL_DOMAINS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

const KNOWN_PRODUCTS = [
  { name: "Google AI Pro", pattern: /\bgoogle ai pro\b/i },
  { name: "Google One", pattern: /\bgoogle one\b/i },
  { name: "YouTube", pattern: /\byoutube(?: premium| music)?\b/i },
  { name: "Spotify Premium", pattern: /\bspotify premium\b/i },
  { name: "Spotify", pattern: /\bspotify\b/i },
  { name: "Netflix", pattern: /\bnetflix\b/i },
  { name: "Hallow", pattern: /\bhallow\b/i },
] as const;

const FREQUENCY_PATTERNS: Array<{ frequency: BillingFrequency; pattern: RegExp }> = [
  { frequency: "weekly", pattern: /\b(?:weekly|per week|every week)\b/i },
  { frequency: "monthly", pattern: /\b(?:monthly|per month|every month|renews monthly)\b/i },
  { frequency: "quarterly", pattern: /\b(?:quarterly|per quarter|every quarter)\b/i },
  {
    frequency: "yearly",
    pattern: /\b(?:annual|annually|yearly|per year|every year|renews annually)\b/i,
  },
];

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type TextField = "subject" | "sender" | "snippet";
type Extraction<T> = { value: T; evidence: string | null };

export function detectSubscriptionCandidate(email: GmailEmail): SubscriptionCandidate {
  const normalizedSender = extractSenderAddress(email.sender);
  const senderDomain = getSenderDomain(normalizedSender);
  const senderMerchant = getSenderMerchant(email.sender, senderDomain);
  const product = extractProductName(email);
  const amount = extractAmount(email);
  const billingFrequency = extractBillingFrequency(email);
  const paymentDate = extractPaymentDate(email);
  const status = extractStatus(email);
  const trial = extractTrial(email);
  const evidence = [
    ...findSubscriptionEvidence(email),
    product.evidence,
    amount.evidence,
    billingFrequency.evidence,
    paymentDate.evidence,
    status.evidence,
    trial.evidence,
  ].filter((item): item is string => item !== null);
  const merchant = product.value ?? senderMerchant;
  const confidence = calculateConfidence({
    evidence,
    productName: product.value,
    amount: amount.value.amount,
    billingFrequency: billingFrequency.value,
    status: status.value,
    merchant,
  });

  return {
    emailId: email.id,
    merchant,
    productName: product.value,
    amount: amount.value.amount,
    currency: amount.value.currency,
    billingFrequency: billingFrequency.value,
    paymentDate: paymentDate.value,
    status: status.value,
    trial: trial.value,
    confidence,
    evidence: [...new Set(evidence)],
    isSubscriptionCandidate: confidence >= 25,
    normalizedSender,
    senderDomain,
  };
}

function extractSenderAddress(sender: string): string {
  const match = sender.match(/<\s*([^>\s]+@[^>\s]+)\s*>|\b([^\s<>]+@[^\s<>]+)\b/i);
  return (match?.[1] ?? match?.[2] ?? sender).trim().toLowerCase();
}

function getSenderDomain(senderAddress: string): string {
  const atIndex = senderAddress.lastIndexOf("@");
  return atIndex === -1 ? "" : senderAddress.slice(atIndex + 1).toLowerCase();
}

function getSenderMerchant(sender: string, senderDomain: string): string {
  const displayName = sender.replace(/<[^>]*>/g, "").replace(/[\"']/g, "").trim();
  if (displayName && !displayName.includes("@") && !GENERIC_SENDER_NAMES.has(displayName.toLowerCase())) {
    return displayName;
  }
  if (!senderDomain) return "Unknown merchant";

  const parts = senderDomain.split(".");
  const suffixLength = parts.length >= 3 && SECOND_LEVEL_DOMAINS.has(parts.at(-2) ?? "") ? 2 : 1;
  return toDisplayName(parts.at(-(suffixLength + 1)) ?? senderDomain) || "Unknown merchant";
}

function extractProductName(email: GmailEmail): Extraction<string | null> {
  const fields = getTextFields(email);
  for (const product of KNOWN_PRODUCTS) {
    const field = fields.find(({ value }) => product.pattern.test(value));
    if (field) return { value: product.name, evidence: `${field.name} contains ${product.name}` };
  }

  for (const field of fields) {
    const match = field.value.match(
      /\b(?:your|the)\s+([a-z0-9][a-z0-9 .+&'-]{1,50}?)\s+(?:subscription|membership|plan)\b/i,
    );
    const productName = match?.[1]?.trim();
    if (productName && !isGenericProductName(productName)) {
      const displayName = toDisplayName(productName);
      return { value: displayName, evidence: `${field.name} contains ${displayName}` };
    }
  }
  return { value: null, evidence: null };
}

function extractAmount(email: GmailEmail): Extraction<{ amount: number | null; currency: Currency | null }> {
  for (const field of getTextFields(email)) {
    const symbolMatch = field.value.match(
      /(?:(INR)\s*)?([₹$€£])\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
    );
    if (symbolMatch) {
      const currency = symbolMatch[1] === "INR" ? "INR" : currencyFromSymbol(symbolMatch[2]);
      const parsedAmount = parseAmount(symbolMatch[3]);
      if (currency && parsedAmount !== null) {
        return { value: { amount: parsedAmount, currency }, evidence: `${field.name} contains ${symbolMatch[2]}` };
      }
    }
    const codeMatch = field.value.match(
      /\b(INR|USD|EUR|GBP)\s+(?:₹\s*)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
    );
    if (codeMatch) {
      const parsedAmount = parseAmount(codeMatch[2]);
      if (parsedAmount !== null) {
        const currency = codeMatch[1].toUpperCase() as Currency;
        return { value: { amount: parsedAmount, currency }, evidence: `${field.name} contains ${currency}` };
      }
    }
  }
  return { value: { amount: null, currency: null }, evidence: null };
}

function extractBillingFrequency(email: GmailEmail): Extraction<BillingFrequency | null> {
  for (const field of getTextFields(email)) {
    const match = FREQUENCY_PATTERNS.find(({ pattern }) => pattern.test(field.value));
    if (match) return { value: match.frequency, evidence: `${field.name} contains ${match.frequency}` };
  }
  return { value: null, evidence: null };
}

function extractPaymentDate(email: GmailEmail): Extraction<string | null> {
  const datePrefix = "(?:payment|paid|charged|renewal(?: date)?|renewed|renews(?: on)?|billing date)\\s*(?:on|for|:)?\\s*";
  const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

  for (const field of getTextFields(email)) {
    const isoMatch = field.value.match(new RegExp(`${datePrefix}(20\\d{2})[-/](\\d{1,2})[-/](\\d{1,2})\\b`, "i"));
    if (isoMatch) {
      const date = toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
      if (date) return { value: date, evidence: `${field.name} contains a payment date` };
    }
    const monthFirst = field.value.match(new RegExp(`${datePrefix}(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(20\\d{2})\\b`, "i"));
    if (monthFirst) {
      const date = toIsoDate(Number(monthFirst[3]), MONTHS[monthFirst[1].toLowerCase()], Number(monthFirst[2]));
      if (date) return { value: date, evidence: `${field.name} contains a payment date` };
    }
    const dayFirst = field.value.match(new RegExp(`${datePrefix}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?[,]?\\s+(20\\d{2})\\b`, "i"));
    if (dayFirst) {
      const date = toIsoDate(Number(dayFirst[3]), MONTHS[dayFirst[2].toLowerCase()], Number(dayFirst[1]));
      if (date) return { value: date, evidence: `${field.name} contains a payment date` };
    }
  }
  return { value: null, evidence: null };
}

function extractStatus(email: GmailEmail): Extraction<SubscriptionStatus> {
  const text = getCombinedText(email);
  if (/\b(?:has )?expired\b/i.test(text)) return { value: "expired", evidence: "email contains expired" };
  if (/\bwill be cancel(?:led|ed)\b|\bsubscription will end\b|\b(?:will end|ending soon|expires on)\b/i.test(text)) return { value: "ending", evidence: "email contains ending or cancellation" };
  if (/\b(?:has been )?cancel(?:led|ed)\b/i.test(text)) return { value: "cancelled", evidence: "email contains cancelled" };
  if (/\btrial\b/i.test(text)) return { value: "trial", evidence: "email contains trial" };
  if (/\b(?:renewed|renewal|payment successful|charged)\b/i.test(text)) return { value: "active", evidence: "email contains renewal or payment" };
  return { value: "unknown", evidence: null };
}

function extractTrial(email: GmailEmail): Extraction<boolean | null> {
  const text = getCombinedText(email);
  if (/\b(?:free )?trial\b/i.test(text)) return { value: true, evidence: "email contains trial" };
  if (/\bnot a trial\b|\bpaid subscription\b/i.test(text)) return { value: false, evidence: "email explicitly indicates a paid subscription" };
  return { value: null, evidence: null };
}

function findSubscriptionEvidence(email: GmailEmail): string[] {
  return getTextFields(email).flatMap((field) => {
    const text = field.value.toLowerCase();
    return SUBSCRIPTION_SIGNALS.filter((signal) => text.includes(signal)).map(
      (signal) => `${field.name} contains ${signal}`,
    );
  });
}

function calculateConfidence({ evidence, productName, amount, billingFrequency, status, merchant }: {
  evidence: string[];
  productName: string | null;
  amount: number | null;
  billingFrequency: BillingFrequency | null;
  status: SubscriptionStatus;
  merchant: string;
}): number {
  const strongSignals = evidence.filter((item) => /(?:subscription|subscribed|renewal|renewed|recurring|membership)/.test(item)).length;
  const transactionSignals = evidence.filter((item) => /(?:billing|payment|receipt|invoice)/.test(item)).length;
  return Math.min(
    strongSignals * 18 + transactionSignals * 8 + (productName ? 18 : 0) +
      (amount !== null ? 14 : 0) + (billingFrequency ? 10 : 0) +
      (status !== "unknown" ? 8 : 0) + (merchant !== "Unknown merchant" ? 4 : 0),
    100,
  );
}

function getTextFields(email: GmailEmail): Array<{ name: TextField; value: string }> {
  return [
    { name: "subject", value: email.subject },
    { name: "sender", value: email.sender },
    { name: "snippet", value: email.snippet },
  ];
}

function getCombinedText(email: GmailEmail): string {
  return `${email.subject} ${email.sender} ${email.snippet}`;
}

function currencyFromSymbol(symbol: string): Currency | null {
  if (symbol === "₹") return "INR";
  if (symbol === "$") return "USD";
  if (symbol === "€") return "EUR";
  if (symbol === "£") return "GBP";
  return null;
}

function parseAmount(value: string): number | null {
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000 ? amount : null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isGenericProductName(value: string): boolean {
  return /^(?:a |an )?(?:subscription|membership|plan|monthly|annual|yearly)$/i.test(value.trim());
}

function toDisplayName(value: string): string {
  return value.trim().split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
