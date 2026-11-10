import { z } from "zod";
import { CONTACT_METHODS } from "../customer";
import { clientRequestId, entityId, optionalEmail, optionalPhone, optionalText, requiredText, versionSchema } from "./common";

export const customerShape = {
  fullName: requiredText(120, "Enter the customer's name."),
  companyName: optionalText(120),
  email: optionalEmail,
  phone: optionalPhone,
  preferredContact: z.enum(CONTACT_METHODS).nullable().default(null),
};

interface ContactFacts {
  email: string | null;
  phone: string | null;
  preferredContact: (typeof CONTACT_METHODS)[number] | null;
}

/** A customer must be reachable, and a preferred method must exist on file. */
export function customerContactRules(v: ContactFacts, ctx: z.RefinementCtx) {
  if (!v.email && !v.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Add a phone number or an email so you can reach this customer." });
  }
  if (v.preferredContact === "email" && !v.email) {
    ctx.addIssue({ code: "custom", path: ["preferredContact"], message: "Add an email address to make email the preferred method." });
  }
  if ((v.preferredContact === "phone" || v.preferredContact === "text") && !v.phone) {
    ctx.addIssue({ code: "custom", path: ["preferredContact"], message: "Add a phone number to prefer calls or texts." });
  }
}

export const createCustomerSchema = z
  .object({
    ...customerShape,
    notes: optionalText(5000),
    confirmDuplicate: z.boolean().default(false),
    clientRequestId,
  })
  .superRefine(customerContactRules);
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

export const updateCustomerSchema = z
  .object({
    id: entityId,
    version: versionSchema,
    ...customerShape,
    notes: optionalText(5000),
    confirmDuplicate: z.boolean().default(false),
  })
  .superRefine(customerContactRules);
export type UpdateCustomerInput = z.input<typeof updateCustomerSchema>;

export const mergeCustomersSchema = z
  .object({ sourceId: entityId, targetId: entityId })
  .refine((v) => v.sourceId !== v.targetId, { path: ["targetId"], message: "Choose a different customer to merge into." });
export type MergeCustomersInput = z.input<typeof mergeCustomersSchema>;

export const deleteCustomerSchema = z.object({ id: entityId });
