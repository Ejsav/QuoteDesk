/**
 * Activity log vocabulary. Every entry is written by the service layer in the
 * same transaction as the change it describes — the timeline is a record of
 * what actually happened in QuoteDesk, never generated filler.
 *
 * Payloads store raw values; formatting happens at render time so labels stay
 * consistent if display rules change.
 */
import type { ContactChannel, ContactDirection } from "./customer";
import { CONTACT_CHANNEL_LABELS, CONTACT_METHOD_LABELS, type ContactMethod } from "./customer";
import { formatPhone } from "./contact";
import { formatDuration, formatPlainDate, formatPlainTime, timeZoneLabel, type PlainDate } from "./dates";
import {
  LEAD_PRIORITY_META,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_META,
  LOST_REASON_LABELS,
  OCCASION_LABELS,
  SERVICE_TYPE_META,
  formatLeadNumber,
  formatPassengers,
  type LeadPriority,
  type LeadSource,
  type LeadStatus,
  type LostReason,
  type Occasion,
  type ServiceType,
} from "./lead";
import { formatCents } from "./money";
import {
  COMPLIANCE_KIND_META,
  COMPLIANCE_STATUS_META,
  OPERATOR_STATUS_META,
  type ComplianceKind,
  type ComplianceStatus,
  type OperatorStatus,
} from "./operator";
import {
  VEHICLE_AMENITY_LABELS,
  VEHICLE_CATEGORY_META,
  vehiclePreferenceLabel,
  type VehicleAmenity,
  type VehicleCategory,
  type VehiclePreference,
} from "./vehicle";

export const ACTIVITY_TYPES = [
  "lead.created",
  "lead.updated",
  "lead.status_changed",
  "lead.priority_changed",
  "lead.follow_up_scheduled",
  "lead.follow_up_completed",
  "lead.follow_up_cleared",
  "lead.customer_changed",
  "lead.deleted",
  "note.added",
  "contact.logged",
  "customer.created",
  "customer.updated",
  "customer.merged",
  "customer.deleted",
  "operator.created",
  "operator.updated",
  "operator.status_changed",
  "operator.deleted",
  "vehicle.added",
  "vehicle.updated",
  "vehicle.removed",
  "compliance.recorded",
  "compliance.removed",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ActivityPayloads {
  "lead.created": { number: number; source: LeadSource; status: LeadStatus };
  "lead.updated": { number: number; changes: FieldChange[] };
  "lead.status_changed": { number: number; from: LeadStatus; to: LeadStatus; lostReason: LostReason | null };
  "lead.priority_changed": { number: number; from: LeadPriority; to: LeadPriority };
  "lead.follow_up_scheduled": { number: number; date: PlainDate; note: string | null; previousDate: PlainDate | null };
  "lead.follow_up_completed": { number: number; date: PlainDate; note: string | null };
  "lead.follow_up_cleared": { number: number; previousDate: PlainDate; reason: "manual" | "lost" };
  "lead.customer_changed": { number: number; fromName: string; toName: string };
  "lead.deleted": { number: number; summary: string };
  "note.added": { body: string };
  "contact.logged": { channel: ContactChannel; direction: ContactDirection; summary: string | null };
  "customer.created": { name: string };
  "customer.updated": { changes: FieldChange[] };
  "customer.merged": { sourceName: string; leadsMoved: number };
  "customer.deleted": { name: string };
  "operator.created": { name: string };
  "operator.updated": { changes: FieldChange[] };
  "operator.status_changed": { from: OperatorStatus; to: OperatorStatus };
  "operator.deleted": { name: string };
  "vehicle.added": { label: string; category: VehicleCategory; capacity: number | null; quantity: number };
  "vehicle.updated": { label: string; changes: FieldChange[] };
  "vehicle.removed": { label: string; category: VehicleCategory };
  "compliance.recorded": { kind: ComplianceKind; label: string | null; status: ComplianceStatus; previousStatus: ComplianceStatus | null };
  "compliance.removed": { kind: ComplianceKind; label: string | null; status: ComplianceStatus };
}

export type ActivityPayload<T extends ActivityType = ActivityType> = ActivityPayloads[T];

// ---------------------------------------------------------------------------
// Field registries — labels and value formatting for change diffs.
// ---------------------------------------------------------------------------

type Formatter = (value: unknown) => string;

const text: Formatter = (v) => (v == null || v === "" ? "—" : String(v));
const date: Formatter = (v) => (typeof v === "string" ? formatPlainDate(v, "medium") : "—");

export const LEAD_FIELDS: Record<string, { label: string; format: Formatter }> = {
  occasion: { label: "Occasion", format: (v) => (v ? OCCASION_LABELS[v as Occasion] : "—") },
  eventName: { label: "Event name", format: text },
  serviceType: { label: "Service type", format: (v) => (v ? SERVICE_TYPE_META[v as ServiceType].label : "—") },
  tripDate: { label: "Trip date", format: date },
  pickupTime: { label: "Pickup time", format: (v) => (typeof v === "string" ? formatPlainTime(v) : "—") },
  timeZone: { label: "Time zone", format: (v) => (typeof v === "string" ? timeZoneLabel(v) : "—") },
  durationMinutes: { label: "Duration", format: (v) => (typeof v === "number" ? formatDuration(v) : "—") },
  pickupLocation: { label: "Pickup", format: text },
  destination: { label: "Destination", format: text },
  stops: {
    label: "Stops",
    format: (v) => (Array.isArray(v) ? (v.length === 0 ? "None" : (v as string[]).join(" → ")) : "—"),
  },
  passengers: {
    label: "Passengers",
    format: (v) => {
      const p = v as { min: number | null; max: number | null } | null;
      return (p && formatPassengers(p.min, p.max)) ?? "Unknown";
    },
  },
  vehicleCategory: { label: "Vehicle", format: (v) => (v ? vehiclePreferenceLabel(v as VehiclePreference) : "—") },
  budgetCents: { label: "Budget", format: (v) => (typeof v === "number" ? formatCents(v) : "—") },
  source: { label: "Source", format: (v) => (v ? LEAD_SOURCE_LABELS[v as LeadSource] : "—") },
  notes: { label: "Internal notes", format: () => "updated" },
  followUpNote: { label: "Follow-up note", format: text },
};

export const CUSTOMER_FIELDS: Record<string, { label: string; format: Formatter }> = {
  fullName: { label: "Name", format: text },
  companyName: { label: "Company", format: text },
  email: { label: "Email", format: text },
  phone: { label: "Phone", format: (v) => (typeof v === "string" ? formatPhone(v) : "—") },
  preferredContact: { label: "Preferred contact", format: (v) => (v ? CONTACT_METHOD_LABELS[v as ContactMethod] : "—") },
  notes: { label: "Notes", format: () => "updated" },
};

export const OPERATOR_FIELDS: Record<string, { label: string; format: Formatter }> = {
  companyName: { label: "Company name", format: text },
  contactName: { label: "Primary contact", format: text },
  phone: { label: "Phone", format: (v) => (typeof v === "string" ? formatPhone(v) : "—") },
  email: { label: "Email", format: text },
  website: { label: "Website", format: text },
  baseLocation: { label: "Base location", format: text },
  serviceAreas: {
    label: "Service areas",
    format: (v) => (Array.isArray(v) && v.length ? (v as string[]).join(", ") : "None"),
  },
  notes: { label: "Relationship notes", format: () => "updated" },
};

export const VEHICLE_FIELDS: Record<string, { label: string; format: Formatter }> = {
  category: { label: "Category", format: (v) => (v ? VEHICLE_CATEGORY_META[v as VehicleCategory].label : "—") },
  label: { label: "Description", format: text },
  quantity: { label: "Quantity", format: text },
  capacity: { label: "Capacity", format: (v) => (typeof v === "number" ? `${v} passengers` : "Unknown") },
  amenities: {
    label: "Amenities",
    format: (v) =>
      Array.isArray(v) && v.length ? (v as VehicleAmenity[]).map((a) => VEHICLE_AMENITY_LABELS[a]).join(", ") : "None",
  },
  notes: { label: "Notes", format: () => "updated" },
  verifiedOn: { label: "Verified", format: (v) => (typeof v === "string" ? formatPlainDate(v) : "Not verified") },
};

export function formatChange(registry: Record<string, { label: string; format: Formatter }>, change: FieldChange) {
  const entry = registry[change.field];
  if (!entry) return { label: change.field, from: text(change.from), to: text(change.to) };
  return { label: entry.label, from: entry.format(change.from), to: entry.format(change.to) };
}

// ---------------------------------------------------------------------------
// Human-readable descriptions
// ---------------------------------------------------------------------------

export interface ActivityLike {
  type: ActivityType;
  data: unknown;
}

export interface ActivityDescription {
  title: string;
  body?: string;
  changes?: Array<{ label: string; from: string; to: string }>;
}

/**
 * @param scope where the entry is shown — on a lead's own timeline the lead
 * reference is implied; in workspace feeds it is spelled out.
 */
export function describeActivity(activity: ActivityLike, scope: "lead" | "customer" | "workspace" = "lead"): ActivityDescription {
  const ref = (n: number) => (scope === "lead" ? "" : ` ${formatLeadNumber(n)}`);
  switch (activity.type) {
    case "lead.created": {
      const d = activity.data as ActivityPayloads["lead.created"];
      return { title: `Created inquiry${ref(d.number)} from ${LEAD_SOURCE_LABELS[d.source].toLowerCase()}` };
    }
    case "lead.updated": {
      const d = activity.data as ActivityPayloads["lead.updated"];
      const changes = d.changes.map((c) => formatChange(LEAD_FIELDS, c));
      const labels = changes.map((c) => c.label.toLowerCase());
      return { title: `Updated${ref(d.number)} ${listLabels(labels)}`, changes };
    }
    case "lead.status_changed": {
      const d = activity.data as ActivityPayloads["lead.status_changed"];
      const to = LEAD_STATUS_META[d.to].label;
      const reason = d.to === "lost" && d.lostReason ? ` — ${LOST_REASON_LABELS[d.lostReason]}` : "";
      return { title: `Moved${ref(d.number)} from ${LEAD_STATUS_META[d.from].label} to ${to}${reason}` };
    }
    case "lead.priority_changed": {
      const d = activity.data as ActivityPayloads["lead.priority_changed"];
      return { title: `Changed priority${ref(d.number)} from ${LEAD_PRIORITY_META[d.from].label} to ${LEAD_PRIORITY_META[d.to].label}` };
    }
    case "lead.follow_up_scheduled": {
      const d = activity.data as ActivityPayloads["lead.follow_up_scheduled"];
      const verb = d.previousDate ? "Rescheduled follow-up" : "Scheduled follow-up";
      return { title: `${verb}${ref(d.number)} for ${formatPlainDate(d.date, "weekday")}`, body: d.note ?? undefined };
    }
    case "lead.follow_up_completed": {
      const d = activity.data as ActivityPayloads["lead.follow_up_completed"];
      return { title: `Completed follow-up${ref(d.number)} due ${formatPlainDate(d.date, "short")}`, body: d.note ?? undefined };
    }
    case "lead.follow_up_cleared": {
      const d = activity.data as ActivityPayloads["lead.follow_up_cleared"];
      return {
        title:
          d.reason === "lost"
            ? `Closed follow-up${ref(d.number)} due ${formatPlainDate(d.previousDate, "short")} — lead marked lost`
            : `Removed follow-up${ref(d.number)} due ${formatPlainDate(d.previousDate, "short")}`,
      };
    }
    case "lead.customer_changed": {
      const d = activity.data as ActivityPayloads["lead.customer_changed"];
      return { title: `Reassigned${ref(d.number)} from ${d.fromName} to ${d.toName}` };
    }
    case "lead.deleted": {
      const d = activity.data as ActivityPayloads["lead.deleted"];
      return { title: `Deleted inquiry ${formatLeadNumber(d.number)}`, body: d.summary };
    }
    case "note.added": {
      const d = activity.data as ActivityPayloads["note.added"];
      return { title: "Added a note", body: d.body };
    }
    case "contact.logged": {
      const d = activity.data as ActivityPayloads["contact.logged"];
      const channel = CONTACT_CHANNEL_LABELS[d.channel].toLowerCase();
      const title =
        d.channel === "meeting"
          ? "Logged a meeting"
          : d.direction === "inbound"
            ? `Logged an inbound ${channel}`
            : `Logged an outbound ${channel}`;
      return { title, body: d.summary ?? undefined };
    }
    case "customer.created": {
      const d = activity.data as ActivityPayloads["customer.created"];
      return { title: scope === "customer" ? "Customer record created" : `Added customer ${d.name}` };
    }
    case "customer.updated": {
      const d = activity.data as ActivityPayloads["customer.updated"];
      const changes = d.changes.map((c) => formatChange(CUSTOMER_FIELDS, c));
      return { title: `Updated ${listLabels(changes.map((c) => c.label.toLowerCase()))}`, changes };
    }
    case "customer.merged": {
      const d = activity.data as ActivityPayloads["customer.merged"];
      return {
        title: `Merged duplicate record “${d.sourceName}”`,
        body: d.leadsMoved > 0 ? `${d.leadsMoved} ${d.leadsMoved === 1 ? "inquiry" : "inquiries"} moved to this customer.` : undefined,
      };
    }
    case "customer.deleted": {
      const d = activity.data as ActivityPayloads["customer.deleted"];
      return { title: `Deleted customer ${d.name}` };
    }
    case "operator.created": {
      const d = activity.data as ActivityPayloads["operator.created"];
      return { title: scope === "workspace" ? `Added operator ${d.name}` : "Operator record created" };
    }
    case "operator.updated": {
      const d = activity.data as ActivityPayloads["operator.updated"];
      const changes = d.changes.map((c) => formatChange(OPERATOR_FIELDS, c));
      return { title: `Updated ${listLabels(changes.map((c) => c.label.toLowerCase()))}`, changes };
    }
    case "operator.status_changed": {
      const d = activity.data as ActivityPayloads["operator.status_changed"];
      return { title: `Changed relationship from ${OPERATOR_STATUS_META[d.from].label} to ${OPERATOR_STATUS_META[d.to].label}` };
    }
    case "operator.deleted": {
      const d = activity.data as ActivityPayloads["operator.deleted"];
      return { title: `Deleted operator ${d.name}` };
    }
    case "vehicle.added": {
      const d = activity.data as ActivityPayloads["vehicle.added"];
      const cap = d.capacity ? ` · ${d.capacity} passengers` : "";
      return { title: `Added ${d.quantity > 1 ? `${d.quantity} × ` : ""}${d.label}${cap}` };
    }
    case "vehicle.updated": {
      const d = activity.data as ActivityPayloads["vehicle.updated"];
      const changes = d.changes.map((c) => formatChange(VEHICLE_FIELDS, c));
      return { title: `Updated ${d.label}`, changes };
    }
    case "vehicle.removed": {
      const d = activity.data as ActivityPayloads["vehicle.removed"];
      return { title: `Removed ${d.label} from the fleet` };
    }
    case "compliance.recorded": {
      const d = activity.data as ActivityPayloads["compliance.recorded"];
      const name = d.label ?? COMPLIANCE_KIND_META[d.kind].label;
      const status = COMPLIANCE_STATUS_META[d.status].label;
      return {
        title: d.previousStatus && d.previousStatus !== d.status
          ? `${name}: ${COMPLIANCE_STATUS_META[d.previousStatus].label} → ${status}`
          : `${name} recorded as ${status.toLowerCase()}`,
      };
    }
    case "compliance.removed": {
      const d = activity.data as ActivityPayloads["compliance.removed"];
      return { title: `Removed ${d.label ?? COMPLIANCE_KIND_META[d.kind].label} record` };
    }
  }
}

function listLabels(labels: string[]): string {
  const unique = [...new Set(labels)];
  if (unique.length === 0) return "details";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more`;
}
