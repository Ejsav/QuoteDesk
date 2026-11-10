/**
 * Operator network vocabulary.
 *
 * Trust model: QuoteDesk records what an operator *told us* separately from
 * what our team *independently verified*. Nothing is ever shown as verified
 * without a dated record of who verified it and what evidence they saw.
 * There are no automated verification integrations in this release.
 */
import { daysBetween, type PlainDate } from "./dates";
import type { Tone } from "./tone";

export const OPERATOR_STATUSES = ["prospect", "active", "preferred", "paused", "do_not_use"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const OPERATOR_STATUS_META: Record<OperatorStatus, { label: string; description: string; tone: Tone }> = {
  prospect: { label: "Prospect", description: "Not yet worked with", tone: "blue" },
  active: { label: "Active", description: "Approved partner in good standing", tone: "green" },
  preferred: { label: "Preferred", description: "First call for matching trips", tone: "champagne" },
  paused: { label: "Paused", description: "Temporarily not sending work", tone: "amber" },
  do_not_use: { label: "Do not use", description: "Do not send work to this operator", tone: "red" },
};

// ---------------------------------------------------------------------------
// Verification & compliance records
// ---------------------------------------------------------------------------

export const COMPLIANCE_KINDS = [
  "insurance",
  "usdot",
  "state_authority",
  "local_license",
  "vehicle_inspection",
  "chauffeur_screening",
  "other",
] as const;
export type ComplianceKind = (typeof COMPLIANCE_KINDS)[number];

export const COMPLIANCE_KIND_META: Record<ComplianceKind, { label: string; evidence: string; expires: boolean }> = {
  insurance: {
    label: "Commercial auto insurance",
    evidence: "Certificate of insurance showing liability limits and the policy period",
    expires: true,
  },
  usdot: {
    label: "USDOT / FMCSA registration",
    evidence: "USDOT number, plus MC operating authority for interstate trips",
    expires: false,
  },
  state_authority: {
    label: "State passenger carrier authority",
    evidence: "Intrastate passenger carrier certificate or permit",
    expires: true,
  },
  local_license: {
    label: "City / airport livery license",
    evidence: "Municipal or airport ground-transportation permit",
    expires: true,
  },
  vehicle_inspection: {
    label: "Vehicle safety inspections",
    evidence: "Current inspection records for the vehicles they'd send",
    expires: true,
  },
  chauffeur_screening: {
    label: "Chauffeur screening",
    evidence: "Background checks and a drug & alcohol testing program",
    expires: false,
  },
  other: { label: "Other document", evidence: "Any other supporting document", expires: true },
};

/** The checklist every operator is measured against. */
export const STANDARD_COMPLIANCE_KINDS = COMPLIANCE_KINDS.filter((k) => k !== "other");

export const COMPLIANCE_STATUSES = ["reported", "received", "verified", "issue"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_STATUS_META: Record<ComplianceStatus, { label: string; description: string; tone: Tone }> = {
  reported: {
    label: "Operator-reported",
    description: "Stated by the operator. No document has been reviewed.",
    tone: "gray",
  },
  received: {
    label: "Document received",
    description: "A document is on file but hasn't been independently confirmed.",
    tone: "blue",
  },
  verified: {
    label: "Verified",
    description: "Independently confirmed by your team, with the evidence recorded.",
    tone: "green",
  },
  issue: {
    label: "Issue found",
    description: "A problem was found — lapsed, mismatched or unconfirmable.",
    tone: "red",
  },
};

export const EXPIRY_WARNING_DAYS = 30;

export type EffectiveComplianceStatus = ComplianceStatus | "expired" | "missing";

export const EFFECTIVE_COMPLIANCE_META: Record<"expired" | "missing", { label: string; tone: Tone; description: string }> = {
  expired: { label: "Expired", tone: "red", description: "The recorded expiration date has passed." },
  missing: { label: "Not on file", tone: "gray", description: "Nothing recorded yet." },
};

export interface ComplianceFacts {
  status: ComplianceStatus;
  expiresOn: PlainDate | null;
}

export interface EffectiveCompliance {
  status: EffectiveComplianceStatus;
  expiringSoon: boolean;
  daysUntilExpiry: number | null;
}

/** Expiration is derived at read time, so a record can never silently go stale. */
export function effectiveCompliance(record: ComplianceFacts | null, today: PlainDate): EffectiveCompliance {
  if (!record) return { status: "missing", expiringSoon: false, daysUntilExpiry: null };
  const daysUntilExpiry = record.expiresOn ? daysBetween(today, record.expiresOn) : null;
  if (daysUntilExpiry != null && daysUntilExpiry < 0 && record.status !== "issue") {
    return { status: "expired", expiringSoon: false, daysUntilExpiry };
  }
  const expiringSoon = daysUntilExpiry != null && daysUntilExpiry <= EXPIRY_WARNING_DAYS && record.status !== "issue";
  return { status: record.status, expiringSoon, daysUntilExpiry };
}

export function complianceStatusMeta(status: EffectiveComplianceStatus): { label: string; tone: Tone; description: string } {
  return status === "expired" || status === "missing" ? EFFECTIVE_COMPLIANCE_META[status] : COMPLIANCE_STATUS_META[status];
}

export interface VerificationSummary {
  tracked: number;
  verified: number;
  unverified: number;
  missing: number;
  expired: number;
  issues: number;
  expiringSoon: number;
}

/** Summary across the standard checklist (one record per standard kind). */
export function verificationSummary(
  records: ReadonlyArray<ComplianceFacts & { kind: ComplianceKind }>,
  today: PlainDate,
): VerificationSummary {
  const summary: VerificationSummary = {
    tracked: STANDARD_COMPLIANCE_KINDS.length,
    verified: 0,
    unverified: 0,
    missing: 0,
    expired: 0,
    issues: 0,
    expiringSoon: 0,
  };
  for (const kind of STANDARD_COMPLIANCE_KINDS) {
    const record = records.find((r) => r.kind === kind) ?? null;
    const eff = effectiveCompliance(record, today);
    if (eff.expiringSoon) summary.expiringSoon += 1;
    switch (eff.status) {
      case "verified":
        summary.verified += 1;
        break;
      case "missing":
        summary.missing += 1;
        break;
      case "expired":
        summary.expired += 1;
        break;
      case "issue":
        summary.issues += 1;
        break;
      default:
        summary.unverified += 1;
    }
  }
  return summary;
}
