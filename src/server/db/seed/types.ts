/**
 * Declarative shapes for the demo dataset plus small step constructors that
 * keep the data files readable. Specs are turned into service calls by
 * `schedule.ts`; nothing here touches the database.
 */
import type { ContactChannel, ContactDirection, ContactMethod } from "@/domain/customer";
import type { PlainDate } from "@/domain/dates";
import type { InitialLeadStatus, LeadPriority, LeadSource, LeadStatus, LostReason, Occasion, ServiceType } from "@/domain/lead";
import type { ComplianceKind, ComplianceStatus, OperatorStatus } from "@/domain/operator";
import type { VehicleAmenity, VehicleCategory, VehiclePreference } from "@/domain/vehicle";

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerSeed {
  key: string;
  fullName: string;
  companyName?: string;
  email?: string;
  /** Any common format; normalized to E.164 by the real schema. */
  phone?: string;
  preferredContact?: ContactMethod;
  notes?: string;
  /** Added to the directory on its own at this moment (required when `notes` is set). */
  addedAt?: Date;
  /** Same contact details as an existing customer, created deliberately anyway. */
  confirmDuplicate?: boolean;
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

/** Exact count, inclusive range, or unknown. */
export type Passengers = number | readonly [number, number] | null;

export interface TripDetails {
  occasion?: Occasion | null;
  eventName?: string | null;
  serviceType?: ServiceType | null;
  tripDate?: PlainDate | null;
  pickupTime?: string | null;
  timeZone?: string;
  durationMinutes?: number | null;
  pickupLocation?: string | null;
  destination?: string | null;
  stops?: string[];
  passengers?: Passengers;
  vehicle?: VehiclePreference | null;
  /** Customer's stated budget in whole dollars — informational only. */
  budget?: number | null;
}

export type LeadStep =
  | { at: Date; kind: "contact"; channel: ContactChannel; direction: ContactDirection; summary: string }
  | { at: Date; kind: "note"; body: string }
  | { at: Date; kind: "status"; to: LeadStatus; reason?: LostReason }
  | { at: Date; kind: "priority"; to: LeadPriority }
  | { at: Date; kind: "followUp"; date: PlainDate; note?: string }
  | { at: Date; kind: "completeFollowUp" }
  | { at: Date; kind: "update"; patch: TripDetails & { notes?: string | null } };

export interface LeadSeed extends TripDetails {
  key: string;
  customer: string;
  /** When the inquiry was received/entered. */
  at: Date;
  source: LeadSource;
  status?: InitialLeadStatus;
  priority?: LeadPriority;
  notes?: string | null;
  steps?: LeadStep[];
}

export const call = (at: Date, summary: string, direction: ContactDirection = "outbound"): LeadStep => ({
  at,
  kind: "contact",
  channel: "call",
  direction,
  summary,
});
export const email = (at: Date, summary: string, direction: ContactDirection = "outbound"): LeadStep => ({
  at,
  kind: "contact",
  channel: "email",
  direction,
  summary,
});
export const text = (at: Date, summary: string, direction: ContactDirection = "outbound"): LeadStep => ({
  at,
  kind: "contact",
  channel: "text",
  direction,
  summary,
});
export const meeting = (at: Date, summary: string): LeadStep => ({ at, kind: "contact", channel: "meeting", direction: "outbound", summary });
export const note = (at: Date, body: string): LeadStep => ({ at, kind: "note", body });
export const qualify = (at: Date): LeadStep => ({ at, kind: "status", to: "qualified" });
export const hold = (at: Date): LeadStep => ({ at, kind: "status", to: "on_hold" });
export const lose = (at: Date, reason: LostReason): LeadStep => ({ at, kind: "status", to: "lost", reason });
export const priority = (at: Date, to: LeadPriority): LeadStep => ({ at, kind: "priority", to });
export const followUp = (at: Date, date: PlainDate, note?: string): LeadStep => ({ at, kind: "followUp", date, note });
export const done = (at: Date): LeadStep => ({ at, kind: "completeFollowUp" });
export const update = (at: Date, patch: TripDetails & { notes?: string | null }): LeadStep => ({ at, kind: "update", patch });

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export interface VehicleSeed {
  category: VehicleCategory;
  label?: string;
  quantity?: number;
  capacity?: number | null;
  amenities?: VehicleAmenity[];
  notes?: string;
  /** Recorded later as its own update, once our team has seen the vehicle. */
  verified?: { at: Date; on: PlainDate; note: string };
}

export interface ComplianceRevision {
  at: Date;
  status: ComplianceStatus;
  reference?: string;
  expiresOn?: PlainDate;
  verifiedOn?: PlainDate;
  evidenceNote?: string;
}

export interface ComplianceSeed extends ComplianceRevision {
  kind: ComplianceKind;
  label?: string;
  /** Later updates to the same record; unspecified fields carry forward. */
  revisions?: ComplianceRevision[];
}

export interface OperatorSeed {
  key: string;
  at: Date;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  baseLocation?: string;
  serviceAreas: string[];
  /** Relationship status when first added. */
  status: OperatorStatus;
  notes?: string;
  vehicles: VehicleSeed[];
  compliance: ComplianceSeed[];
  statusChanges?: Array<{ at: Date; to: OperatorStatus }>;
  noteUpdates?: Array<{ at: Date; notes: string }>;
}
