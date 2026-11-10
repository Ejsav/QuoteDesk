/**
 * Lead form model — pure functions, no React.
 *
 * The form holds strings (what inputs produce). `buildLeadInput` converts them
 * into the exact API input the server action accepts; the same Zod schema the
 * server uses then validates it client-side, so rules live in one place.
 */
import type { ContactMethod } from "@/domain/customer";
import { DEFAULT_BUSINESS_TIME_ZONE } from "@/domain/dates";
import type { InitialLeadStatus, LeadPriority, LeadSource, Occasion, ServiceType } from "@/domain/lead";
import { centsToInput, parseMoneyToCents } from "@/domain/money";
import { createLeadSchema, updateLeadSchema, type CreateLeadInput, type UpdateLeadInput } from "@/domain/schemas/lead";
import type { VehiclePreference } from "@/domain/vehicle";

export interface LeadFormValues {
  customerMode: "existing" | "new";
  customerId: string;
  newCustomer: { fullName: string; companyName: string; phone: string; email: string; preferredContact: "" | ContactMethod };
  occasion: "" | Occasion;
  eventName: string;
  serviceType: "" | ServiceType;
  tripDate: string;
  pickupTime: string;
  timeZone: string;
  durationHours: string;
  pickupLocation: string;
  destination: string;
  stops: Array<{ location: string; note: string }>;
  passengersMode: "exact" | "range" | "unknown";
  passengersExact: string;
  passengersMin: string;
  passengersMax: string;
  vehicleCategory: "" | VehiclePreference;
  budget: string;
  source: "" | LeadSource;
  priority: LeadPriority;
  initialStatus: InitialLeadStatus;
  followUpDate: string;
  followUpNote: string;
  notes: string;
}

export function emptyLeadForm(timeZone: string = DEFAULT_BUSINESS_TIME_ZONE): LeadFormValues {
  return {
    customerMode: "existing",
    customerId: "",
    newCustomer: { fullName: "", companyName: "", phone: "", email: "", preferredContact: "" },
    occasion: "",
    eventName: "",
    serviceType: "",
    tripDate: "",
    pickupTime: "",
    timeZone,
    durationHours: "",
    pickupLocation: "",
    destination: "",
    stops: [],
    passengersMode: "unknown",
    passengersExact: "",
    passengersMin: "",
    passengersMax: "",
    vehicleCategory: "",
    budget: "",
    source: "",
    priority: "normal",
    initialStatus: "new",
    followUpDate: "",
    followUpNote: "",
    notes: "",
  };
}

/** Stored lead → form values (edit mode). */
export function leadToFormValues(lead: {
  customerId: string;
  occasion: Occasion | null;
  eventName: string | null;
  serviceType: ServiceType | null;
  tripDate: string | null;
  pickupTime: string | null;
  timeZone: string;
  durationMinutes: number | null;
  pickupLocation: string | null;
  destination: string | null;
  passengersMin: number | null;
  passengersMax: number | null;
  vehicleCategory: VehiclePreference | null;
  budgetCents: number | null;
  source: LeadSource;
  priority: LeadPriority;
  followUpDate: string | null;
  followUpNote: string | null;
  notes: string | null;
}, stops: Array<{ location: string; note: string | null }>): LeadFormValues {
  const exact = lead.passengersMin != null && lead.passengersMin === lead.passengersMax;
  return {
    ...emptyLeadForm(lead.timeZone),
    customerMode: "existing",
    customerId: lead.customerId,
    occasion: lead.occasion ?? "",
    eventName: lead.eventName ?? "",
    serviceType: lead.serviceType ?? "",
    tripDate: lead.tripDate ?? "",
    pickupTime: lead.pickupTime ?? "",
    durationHours: lead.durationMinutes != null ? String(Math.round((lead.durationMinutes / 60) * 100) / 100) : "",
    pickupLocation: lead.pickupLocation ?? "",
    destination: lead.destination ?? "",
    stops: stops.map((s) => ({ location: s.location, note: s.note ?? "" })),
    passengersMode: lead.passengersMin == null ? "unknown" : exact ? "exact" : "range",
    passengersExact: exact ? String(lead.passengersMin) : "",
    passengersMin: !exact && lead.passengersMin != null ? String(lead.passengersMin) : "",
    passengersMax: !exact && lead.passengersMax != null ? String(lead.passengersMax) : "",
    vehicleCategory: lead.vehicleCategory ?? "",
    budget: centsToInput(lead.budgetCents),
    source: lead.source,
    priority: lead.priority,
    followUpDate: lead.followUpDate ?? "",
    followUpNote: lead.followUpNote ?? "",
    notes: lead.notes ?? "",
  };
}

export type FormErrors = Record<string, string>;

function parseWhole(value: string, field: string, errors: FormErrors): number | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d+$/.test(v)) {
    errors[field] = "Enter a whole number.";
    return null;
  }
  return Number(v);
}

interface BuildContext {
  mode: "create" | "edit";
  clientRequestId?: string;
  confirmDuplicate?: boolean;
  leadId?: string;
  version?: number;
}

type BuildResult =
  | { ok: true; input: CreateLeadInput | UpdateLeadInput }
  | { ok: false; errors: FormErrors };

/** Convert form strings to API input and validate with the server's schema. */
export function buildLeadInput(values: LeadFormValues, ctx: BuildContext): BuildResult {
  const errors: FormErrors = {};

  let passengersMin: number | null = null;
  let passengersMax: number | null = null;
  if (values.passengersMode === "exact") {
    passengersMin = parseWhole(values.passengersExact, "passengersExact", errors);
    passengersMax = passengersMin;
    if (passengersMin == null && !errors.passengersExact) errors.passengersExact = "Enter the passenger count, or choose Unknown.";
  } else if (values.passengersMode === "range") {
    passengersMin = parseWhole(values.passengersMin, "passengersMin", errors);
    passengersMax = parseWhole(values.passengersMax, "passengersMax", errors);
    if (passengersMin == null && !errors.passengersMin) errors.passengersMin = "Enter the low end of the range.";
    if (passengersMax == null && !errors.passengersMax) errors.passengersMax = "Enter the high end of the range.";
  }

  let durationMinutes: number | null = null;
  const duration = values.durationHours.trim();
  if (duration) {
    const hours = Number(duration);
    if (!Number.isFinite(hours) || hours <= 0) errors.durationHours = "Enter hours, like 4 or 5.5.";
    else durationMinutes = Math.round(hours * 60);
  }

  const budget = parseMoneyToCents(values.budget);
  if (!budget.ok) errors.budget = budget.message;

  if (values.customerMode === "existing" && !values.customerId) {
    errors.customerId = ctx.mode === "create" ? "Choose a customer, or add a new one." : "Choose a customer.";
  }
  // Keep going even if a field failed to parse: the schema pass below adds its
  // findings, so the person sees every problem in one submit.

  const common = {
    occasion: values.occasion || null,
    eventName: values.eventName,
    serviceType: values.serviceType || null,
    tripDate: values.tripDate || null,
    pickupTime: values.pickupTime || null,
    timeZone: values.timeZone,
    durationMinutes,
    pickupLocation: values.pickupLocation,
    destination: values.destination,
    stops: values.stops.map((s) => ({ location: s.location, note: s.note })),
    passengersMin,
    passengersMax,
    vehicleCategory: values.vehicleCategory || null,
    budgetCents: budget.ok ? budget.cents : null,
    source: (values.source || undefined) as LeadSource,
    priority: values.priority,
    followUpDate: values.followUpDate || null,
    followUpNote: values.followUpNote,
    notes: values.notes,
  };

  if (ctx.mode === "create") {
    const input: CreateLeadInput = {
      ...common,
      customer:
        values.customerMode === "existing"
          ? { mode: "existing", customerId: values.customerId }
          : {
              mode: "new",
              fullName: values.newCustomer.fullName,
              companyName: values.newCustomer.companyName,
              phone: values.newCustomer.phone,
              email: values.newCustomer.email,
              preferredContact: values.newCustomer.preferredContact || null,
              confirmDuplicate: ctx.confirmDuplicate ?? false,
            },
      initialStatus: values.initialStatus,
      clientRequestId: ctx.clientRequestId ?? "",
    };
    const parsed = createLeadSchema.safeParse(input);
    return finish(input, errors, parsed.success ? [] : parsed.error.issues, values);
  }

  const input: UpdateLeadInput = { ...common, id: ctx.leadId ?? "", version: ctx.version ?? 1, customerId: values.customerId };
  const parsed = updateLeadSchema.safeParse(input);
  return finish(input, errors, parsed.success ? [] : parsed.error.issues, values);
}

/** Merge parse-stage errors (which take precedence) with schema issues. */
function finish(
  input: CreateLeadInput | UpdateLeadInput,
  parseErrors: FormErrors,
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  values: LeadFormValues,
): BuildResult {
  const errors: FormErrors = { ...mapIssues(issues, values), ...parseErrors };
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input };
}

/** API path ("customer.phone", "passengersMin") → form field name. */
export function toFormPath(path: string, values: Pick<LeadFormValues, "passengersMode">): string {
  if (path === "customer.customerId" || path === "customerId" || path === "customer") return "customerId";
  if (path.startsWith("customer.")) return `newCustomer.${path.slice("customer.".length)}`;
  if (path === "passengersMin") return values.passengersMode === "exact" ? "passengersExact" : "passengersMin";
  if (path === "passengersMax") return values.passengersMode === "exact" ? "passengersExact" : "passengersMax";
  if (path === "durationMinutes") return "durationHours";
  if (path === "budgetCents") return "budget";
  return path;
}

export function mapIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>, values: Pick<LeadFormValues, "passengersMode">): FormErrors {
  const out: FormErrors = {};
  for (const issue of issues) {
    const key = toFormPath(issue.path.map(String).join("."), values);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function mapServerFieldErrors(fieldErrors: Record<string, string[]>, values: Pick<LeadFormValues, "passengersMode">): FormErrors {
  const out: FormErrors = {};
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const key = toFormPath(path, values);
    if (!out[key] && messages[0]) out[key] = messages[0];
  }
  return out;
}

/** Form-order list of fields, used to focus the first error. */
export const FIELD_ORDER = [
  "customerId",
  "newCustomer.fullName",
  "newCustomer.phone",
  "newCustomer.email",
  "newCustomer.companyName",
  "newCustomer.preferredContact",
  "occasion",
  "eventName",
  "serviceType",
  "tripDate",
  "pickupTime",
  "timeZone",
  "durationHours",
  "pickupLocation",
  "destination",
  "passengersExact",
  "passengersMin",
  "passengersMax",
  "vehicleCategory",
  "budget",
  "source",
  "priority",
  "initialStatus",
  "followUpDate",
  "followUpNote",
  "notes",
];
