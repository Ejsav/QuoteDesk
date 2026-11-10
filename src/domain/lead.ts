/**
 * Lead (transportation inquiry) vocabulary and business rules.
 *
 * Scope boundary: this release covers intake → qualification. A lead is a
 * customer's *request*. Nothing here implies an operator has confirmed
 * availability, a price has been quoted, or a booking exists. Those states
 * belong to future Quote / Reservation records that reference a lead.
 */
import { addDays, daysBetween, type PlainDate } from "./dates";
import type { Tone } from "./tone";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export const LEAD_STATUSES = ["new", "contacted", "qualified", "on_hold", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; description: string; tone: Tone }> = {
  new: { label: "New", description: "Received — awaiting first contact", tone: "blue" },
  contacted: { label: "Contacted", description: "In conversation, gathering trip requirements", tone: "magenta" },
  qualified: { label: "Qualified", description: "Requirements confirmed — ready to quote", tone: "green" },
  on_hold: { label: "On hold", description: "Paused — the customer isn't ready yet", tone: "amber" },
  lost: { label: "Lost", description: "Closed without moving forward", tone: "gray" },
};

/** Leads being actively worked. */
export const ACTIVE_LEAD_STATUSES = ["new", "contacted", "qualified"] as const satisfies readonly LeadStatus[];
/** Leads that are not closed (includes paused leads). */
export const OPEN_LEAD_STATUSES = ["new", "contacted", "qualified", "on_hold"] as const satisfies readonly LeadStatus[];

export function isOpenStatus(status: LeadStatus): boolean {
  return status !== "lost";
}

/** Statuses a brand-new inquiry may start in (e.g. qualified on the intake call). */
export const INITIAL_LEAD_STATUSES = ["new", "contacted", "qualified"] as const satisfies readonly LeadStatus[];
export type InitialLeadStatus = (typeof INITIAL_LEAD_STATUSES)[number];

export const LOST_REASONS = [
  "no_response",
  "chose_competitor",
  "budget",
  "trip_cancelled",
  "not_a_fit",
  "duplicate",
  "spam",
  "other",
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  no_response: "No response",
  chose_competitor: "Chose another provider",
  budget: "Budget mismatch",
  trip_cancelled: "Trip cancelled",
  not_a_fit: "Not a fit for our network",
  duplicate: "Duplicate inquiry",
  spam: "Spam",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Priority, source, occasion, service type
// ---------------------------------------------------------------------------

export const LEAD_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_META: Record<LeadPriority, { label: string; tone: Tone; rank: number }> = {
  low: { label: "Low", tone: "gray", rank: 0 },
  normal: { label: "Normal", tone: "gray", rank: 1 },
  high: { label: "High", tone: "orange", rank: 2 },
  urgent: { label: "Urgent", tone: "red", rank: 3 },
};

export const LEAD_SOURCES = [
  "website",
  "phone",
  "email",
  "referral",
  "partner",
  "repeat",
  "instagram",
  "google",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website form",
  phone: "Phone call",
  email: "Email",
  referral: "Referral",
  partner: "Venue / planner partner",
  repeat: "Repeat client",
  instagram: "Instagram",
  google: "Google search",
  other: "Other",
};

export const OCCASIONS = [
  "wedding",
  "corporate",
  "airport",
  "bachelor",
  "birthday",
  "nightlife",
  "prom",
  "concert_sports",
  "wine_tour",
  "funeral",
  "group_event",
  "other",
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OCCASION_LABELS: Record<Occasion, string> = {
  wedding: "Wedding",
  corporate: "Corporate event",
  airport: "Airport transfer",
  bachelor: "Bachelor / bachelorette",
  birthday: "Birthday",
  nightlife: "Night out",
  prom: "Prom / homecoming",
  concert_sports: "Concert / game",
  wine_tour: "Wine & brewery tour",
  funeral: "Funeral / memorial",
  group_event: "Group event",
  other: "Other",
};

export const SERVICE_TYPES = ["one_way", "round_trip", "hourly"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; description: string }> = {
  one_way: { label: "One way", description: "Point-to-point transfer" },
  round_trip: { label: "Round trip", description: "Out and back, with a wait or a later return" },
  hourly: { label: "Hourly", description: "Vehicle as directed for a block of time" },
};

// ---------------------------------------------------------------------------
// References & display
// ---------------------------------------------------------------------------

export function formatLeadNumber(n: number): string {
  return `L-${n}`;
}

/** Accepts "L-1042", "l1042", "#1042" or "1042". */
export function parseLeadNumber(query: string): number | null {
  const m = /^\s*(?:l-?|#)?\s*(\d{3,7})\s*$/i.exec(query);
  return m ? Number(m[1]) : null;
}

export function leadTitle(lead: { eventName: string | null; occasion: Occasion | null }): string {
  if (lead.eventName) return lead.eventName;
  if (lead.occasion) return OCCASION_LABELS[lead.occasion];
  return "Transportation inquiry";
}

export function formatPassengers(min: number | null, max: number | null): string | null {
  if (min == null) return null;
  if (max == null || max === min) return `${min}`;
  return `${min}–${max}`;
}

// ---------------------------------------------------------------------------
// Qualification rule
//
// "Qualified" means ready to quote, so it requires the facts any quote needs.
// Enforced on the server for both status changes and edits of qualified leads.
// ---------------------------------------------------------------------------

export type QualificationField = "tripDate" | "pickupLocation" | "passengers";

export const QUALIFICATION_FIELD_LABELS: Record<QualificationField, string> = {
  tripDate: "trip date",
  pickupLocation: "pickup location",
  passengers: "passenger count",
};

export interface QualificationFacts {
  tripDate: PlainDate | null;
  pickupLocation: string | null;
  passengersMin: number | null;
}

export function missingForQualification(lead: QualificationFacts): QualificationField[] {
  const missing: QualificationField[] = [];
  if (!lead.tripDate) missing.push("tripDate");
  if (!lead.pickupLocation) missing.push("pickupLocation");
  if (lead.passengersMin == null) missing.push("passengers");
  return missing;
}

export function describeMissing(fields: QualificationField[]): string {
  const labels = fields.map((f) => QUALIFICATION_FIELD_LABELS[f]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Quote readiness — what's known vs. still missing.
// ---------------------------------------------------------------------------

export interface ReadinessFacts extends QualificationFacts {
  pickupTime: string | null;
  destination: string | null;
  serviceType: ServiceType | null;
  vehicleCategory: string | null;
  durationMinutes: number | null;
}

export type ReadinessKey =
  | "tripDate"
  | "pickupLocation"
  | "passengers"
  | "pickupTime"
  | "destination"
  | "serviceType"
  | "vehicle"
  | "duration";

export interface ReadinessItem {
  key: ReadinessKey;
  label: string;
  complete: boolean;
  /** Essential items gate qualification; the rest make a quote accurate. */
  essential: boolean;
}

export interface Readiness {
  items: ReadinessItem[];
  completed: number;
  total: number;
  missingEssential: ReadinessItem[];
  missingDetails: ReadinessItem[];
}

export function evaluateReadiness(lead: ReadinessFacts): Readiness {
  const items: ReadinessItem[] = [
    { key: "tripDate", label: "Trip date", complete: !!lead.tripDate, essential: true },
    { key: "pickupLocation", label: "Pickup location", complete: !!lead.pickupLocation, essential: true },
    { key: "passengers", label: "Passenger count", complete: lead.passengersMin != null, essential: true },
    { key: "pickupTime", label: "Pickup time", complete: !!lead.pickupTime, essential: false },
    { key: "serviceType", label: "Service type", complete: !!lead.serviceType, essential: false },
  ];
  // Hourly charters run "as directed", so a final destination is optional.
  if (lead.serviceType !== "hourly") {
    items.push({ key: "destination", label: "Destination", complete: !!lead.destination, essential: false });
  }
  items.push({ key: "vehicle", label: "Vehicle preference", complete: !!lead.vehicleCategory, essential: false });
  if (lead.serviceType === "hourly" || lead.serviceType === "round_trip") {
    items.push({ key: "duration", label: "Duration", complete: lead.durationMinutes != null, essential: false });
  }
  const completed = items.filter((i) => i.complete).length;
  return {
    items,
    completed,
    total: items.length,
    missingEssential: items.filter((i) => i.essential && !i.complete),
    missingDetails: items.filter((i) => !i.essential && !i.complete),
  };
}

// ---------------------------------------------------------------------------
// Follow-ups (calendar dates in the business time zone)
// ---------------------------------------------------------------------------

export type FollowUpState =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "upcoming"; days: number };

export function followUpState(followUpDate: PlainDate | null, today: PlainDate): FollowUpState {
  if (!followUpDate) return { kind: "none" };
  const diff = daysBetween(today, followUpDate);
  if (diff < 0) return { kind: "overdue", days: -diff };
  if (diff === 0) return { kind: "today" };
  return { kind: "upcoming", days: diff };
}

/** Quick-pick follow-up dates offered in the UI. */
export function followUpPresets(today: PlainDate): Array<{ label: string; date: PlainDate }> {
  return [
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "In 3 days", date: addDays(today, 3) },
    { label: "Next week", date: addDays(today, 7) },
    { label: "In 2 weeks", date: addDays(today, 14) },
  ];
}

// ---------------------------------------------------------------------------
// Attention — the single definition of "this lead needs someone now".
// The leads list's SQL filter mirrors these rules (see services/leads.ts) and
// a test asserts both agree on the demo dataset.
// ---------------------------------------------------------------------------

export const ATTENTION_RULES = {
  /** Unqualified leads whose trip is this close are urgent. */
  tripSoonDays: 7,
  /** Working leads with no activity this long and no follow-up are stale. */
  staleAfterDays: 7,
  /** New inquiries should get a first response within this window. */
  firstContactSlaHours: 24,
} as const;

export type AttentionReason =
  | { kind: "trip_soon_unqualified"; days: number }
  | { kind: "follow_up_overdue"; days: number }
  | { kind: "awaiting_first_contact"; hours: number; breachedSla: boolean }
  | { kind: "follow_up_today" }
  | { kind: "trip_date_passed"; days: number }
  | { kind: "stale"; days: number };

export interface AttentionFacts {
  status: LeadStatus;
  tripDate: PlainDate | null;
  followUpDate: PlainDate | null;
  createdAt: Date;
  lastActivityAt: Date;
}

const DAY_MS = 86_400_000;

export function attentionReason(lead: AttentionFacts, ctx: { now: Date; today: PlainDate }): AttentionReason | null {
  if (lead.status === "lost") return null;
  const { now, today } = ctx;

  if (lead.tripDate && (lead.status === "new" || lead.status === "contacted")) {
    const days = daysBetween(today, lead.tripDate);
    if (days >= 0 && days <= ATTENTION_RULES.tripSoonDays) return { kind: "trip_soon_unqualified", days };
  }

  const followUp = followUpState(lead.followUpDate, today);
  if (followUp.kind === "overdue") return { kind: "follow_up_overdue", days: followUp.days };

  if (lead.status === "new") {
    const hours = Math.max(0, Math.floor((now.getTime() - lead.createdAt.getTime()) / 3_600_000));
    return { kind: "awaiting_first_contact", hours, breachedSla: hours >= ATTENTION_RULES.firstContactSlaHours };
  }

  if (followUp.kind === "today") return { kind: "follow_up_today" };

  if (lead.tripDate && daysBetween(today, lead.tripDate) < 0) {
    return { kind: "trip_date_passed", days: daysBetween(lead.tripDate, today) };
  }

  if ((lead.status === "contacted" || lead.status === "qualified") && followUp.kind === "none") {
    const idleDays = Math.floor((now.getTime() - lead.lastActivityAt.getTime()) / DAY_MS);
    if (idleDays >= ATTENTION_RULES.staleAfterDays) return { kind: "stale", days: idleDays };
  }

  return null;
}

/** Lower rank = more urgent. Used to order the attention queue. */
export const ATTENTION_RANK: Record<AttentionReason["kind"], number> = {
  trip_soon_unqualified: 0,
  follow_up_overdue: 1,
  awaiting_first_contact: 2,
  follow_up_today: 3,
  trip_date_passed: 4,
  stale: 5,
};

export function describeAttention(reason: AttentionReason): { label: string; tone: Tone } {
  switch (reason.kind) {
    case "trip_soon_unqualified":
      return {
        label: reason.days === 0 ? "Trip is today — not qualified" : `Trip in ${reason.days} ${reason.days === 1 ? "day" : "days"} — not qualified`,
        tone: "red",
      };
    case "follow_up_overdue":
      return { label: `Follow-up overdue by ${reason.days} ${reason.days === 1 ? "day" : "days"}`, tone: "red" };
    case "awaiting_first_contact":
      return {
        label: reason.hours < 1 ? "New — awaiting first contact" : `Awaiting first contact · ${formatHours(reason.hours)}`,
        tone: reason.breachedSla ? "red" : "blue",
      };
    case "follow_up_today":
      return { label: "Follow-up due today", tone: "amber" };
    case "trip_date_passed":
      return { label: `Trip date passed ${reason.days} ${reason.days === 1 ? "day" : "days"} ago — update status`, tone: "amber" };
    case "stale":
      return { label: `No activity in ${reason.days} days`, tone: "amber" };
  }
}

function formatHours(hours: number): string {
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export interface TransitionLead extends QualificationFacts {
  status: LeadStatus;
  qualifiedAt: Date | null;
  firstResponseAt: Date | null;
  followUpDate: PlainDate | null;
}

export interface StatusPatch {
  status: LeadStatus;
  lostReason: LostReason | null;
  statusChangedAt: Date;
  qualifiedAt: Date | null;
  firstResponseAt: Date | null;
  followUpDate: PlainDate | null;
  followUpNote?: null;
}

export type TransitionResult =
  | { ok: true; patch: StatusPatch; clearedFollowUp: PlainDate | null }
  | { ok: false; code: "unchanged" | "lost_reason_required" | "not_qualifiable"; message: string; missing?: QualificationField[] };

/**
 * Pure planner for a status change. Encodes every side effect in one place:
 * - Lost requires a reason, and closes any open follow-up.
 * - Qualified requires the qualification facts; `qualifiedAt` records the
 *   first time a lead reached Qualified and is never cleared.
 * - The first move out of New (to anything but Lost) is the first response.
 */
export function planStatusTransition(
  lead: TransitionLead,
  to: LeadStatus,
  opts: { lostReason?: LostReason | null; now: Date },
): TransitionResult {
  if (lead.status === to) {
    return { ok: false, code: "unchanged", message: `This lead is already ${LEAD_STATUS_META[to].label.toLowerCase()}.` };
  }
  if (to === "lost" && !opts.lostReason) {
    return { ok: false, code: "lost_reason_required", message: "Choose a reason before marking this lead as lost." };
  }
  if (to === "qualified") {
    const missing = missingForQualification(lead);
    if (missing.length > 0) {
      return {
        ok: false,
        code: "not_qualifiable",
        message: `Add the ${describeMissing(missing)} before qualifying this lead.`,
        missing,
      };
    }
  }
  const respondedNow = lead.status === "new" && to !== "lost" && !lead.firstResponseAt;
  const patch: StatusPatch = {
    status: to,
    lostReason: to === "lost" ? (opts.lostReason ?? null) : null,
    statusChangedAt: opts.now,
    qualifiedAt: to === "qualified" && !lead.qualifiedAt ? opts.now : lead.qualifiedAt,
    firstResponseAt: respondedNow ? opts.now : lead.firstResponseAt,
    followUpDate: to === "lost" ? null : lead.followUpDate,
  };
  if (to === "lost") patch.followUpNote = null;
  return { ok: true, patch, clearedFollowUp: to === "lost" ? lead.followUpDate : null };
}
