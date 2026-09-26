import type {
  BillingFrequency,
  Currency,
  SubscriptionCandidate,
  SubscriptionStatus,
} from "@/utils/subscription-detection";

export type SubscriptionDecision = "KEEP" | "REVIEW" | "KILL";

export type SubscriptionRecord = {
  id: string;
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
  monthlyCost: number | null;
  yearlyCost: number | null;
  category: string;
  decision: SubscriptionDecision;
};

export function createSubscriptionRecords(
  candidates: SubscriptionCandidate[],
): SubscriptionRecord[] {
  const records = candidates
    .filter(isUsableCandidate)
    .map(normalizeCandidate);

  return deduplicateRecords(records);
}

function isUsableCandidate(candidate: SubscriptionCandidate): boolean {
  const identity = cleanText(candidate.productName ?? candidate.merchant);

  return candidate.confidence >= 30 && !isGenericIdentity(identity);
}

function normalizeCandidate(candidate: SubscriptionCandidate): SubscriptionRecord {
  const merchant = cleanText(candidate.productName ?? candidate.merchant);
  const productName = candidate.productName ? cleanText(candidate.productName) : null;
  const costs = calculateCosts(candidate.amount, candidate.billingFrequency);
  const status = candidate.status;

  return {
    id: createRecordId(merchant, candidate.currency),
    merchant,
    productName,
    amount: candidate.amount,
    currency: candidate.currency,
    billingFrequency: candidate.billingFrequency,
    paymentDate: candidate.paymentDate,
    status,
    trial: candidate.trial,
    confidence: candidate.confidence,
    evidence: candidate.evidence,
    monthlyCost: costs.monthlyCost,
    yearlyCost: costs.yearlyCost,
    category: getCategory(merchant),
    decision: getDecision(status, candidate.confidence, candidate.trial),
  };
}

function deduplicateRecords(records: SubscriptionRecord[]): SubscriptionRecord[] {
  return records.reduce<SubscriptionRecord[]>((deduplicated, record) => {
    const existingIndex = deduplicated.findIndex(
      (existing) =>
        getIdentity(existing) === getIdentity(record) &&
        currenciesCanRepresentSameSubscription(existing.currency, record.currency),
    );

    if (existingIndex === -1) {
      deduplicated.push(record);
      return deduplicated;
    }

    deduplicated[existingIndex] = mergeRecords(deduplicated[existingIndex], record);
    return deduplicated;
  }, []);
}

function mergeRecords(
  existing: SubscriptionRecord,
  incoming: SubscriptionRecord,
): SubscriptionRecord {
  const preferred = choosePreferredRecord(existing, incoming);
  const fallback = preferred === existing ? incoming : existing;
  const amount = preferred.amount ?? fallback.amount;
  const billingFrequency = preferred.billingFrequency ?? fallback.billingFrequency;
  const currency = preferred.currency ?? fallback.currency;
  const costs = calculateCosts(amount, billingFrequency);
  const status = chooseStatus(existing.status, incoming.status);
  const trial = existing.trial === true || incoming.trial === true
    ? true
    : existing.trial ?? incoming.trial;
  const confidence = Math.max(existing.confidence, incoming.confidence);

  return {
    ...preferred,
    id: createRecordId(preferred.merchant, currency),
    amount,
    currency,
    billingFrequency,
    paymentDate: preferred.paymentDate ?? fallback.paymentDate,
    status,
    trial,
    confidence,
    evidence: [...new Set([...existing.evidence, ...incoming.evidence])],
    monthlyCost: costs.monthlyCost,
    yearlyCost: costs.yearlyCost,
    decision: getDecision(status, confidence, trial),
  };
}

function choosePreferredRecord(
  first: SubscriptionRecord,
  second: SubscriptionRecord,
): SubscriptionRecord {
  const firstCompleteness = Number(first.amount !== null) + Number(first.billingFrequency !== null);
  const secondCompleteness = Number(second.amount !== null) + Number(second.billingFrequency !== null);

  if (secondCompleteness > firstCompleteness) return second;
  if (secondCompleteness < firstCompleteness) return first;
  return second.confidence > first.confidence ? second : first;
}

function chooseStatus(
  first: SubscriptionStatus,
  second: SubscriptionStatus,
): SubscriptionStatus {
  const priority: Record<SubscriptionStatus, number> = {
    expired: 6,
    cancelled: 5,
    ending: 4,
    trial: 3,
    active: 2,
    unknown: 1,
  };

  return priority[second] > priority[first] ? second : first;
}

function calculateCosts(
  amount: number | null,
  billingFrequency: BillingFrequency | null,
): { monthlyCost: number | null; yearlyCost: number | null } {
  if (amount === null || billingFrequency === null) {
    return { monthlyCost: null, yearlyCost: null };
  }

  const monthlyCost = {
    weekly: (amount * 52) / 12,
    monthly: amount,
    quarterly: amount / 3,
    yearly: amount / 12,
  }[billingFrequency];

  return { monthlyCost, yearlyCost: monthlyCost * 12 };
}

function getDecision(
  status: SubscriptionStatus,
  confidence: number,
  trial: boolean | null,
): SubscriptionDecision {
  if (status === "cancelled" || status === "ending" || status === "expired") {
    return "KILL";
  }

  if (status === "active" && confidence >= 60 && trial !== true) {
    return "KEEP";
  }

  return "REVIEW";
}

function getCategory(merchant: string): string {
  const identity = merchant.toLowerCase();
  if (/youtube|spotify|netflix/.test(identity)) return "Entertainment";
  if (/hallow/.test(identity)) return "Wellness";
  if (/google ai|google one/.test(identity)) return "Software";
  return "Other";
}

function getIdentity(record: SubscriptionRecord): string {
  return cleanText(record.productName ?? record.merchant)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function currenciesCanRepresentSameSubscription(
  first: Currency | null,
  second: Currency | null,
): boolean {
  return first === null || second === null || first === second;
}

function createRecordId(merchant: string, currency: Currency | null): string {
  return `${cleanText(merchant).toLowerCase().replace(/[^a-z0-9]/g, "-")}-${currency ?? "unknown"}`;
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isGenericIdentity(identity: string): boolean {
  if (!identity || identity.toLowerCase() === "unknown merchant") return true;

  const words = identity.toLowerCase().match(/[a-z]+/g) ?? [];
  const genericWords = new Set([
    "a",
    "an",
    "and",
    "for",
    "help",
    "keep",
    "membership",
    "plan",
    "subscription",
    "subscriptions",
    "the",
    "to",
    "your",
  ]);

  return words.length === 0 || words.every((word) => genericWords.has(word));
}
