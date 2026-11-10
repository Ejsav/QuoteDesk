"use server";

import {
  addLeadNoteSchema,
  changeLeadPrioritySchema,
  changeLeadStatusSchema,
  clearFollowUpSchema,
  completeFollowUpSchema,
  createLeadSchema,
  deleteLeadSchema,
  logLeadContactSchema,
  scheduleFollowUpSchema,
  updateLeadSchema,
} from "@/domain/schemas/lead";
import * as leads from "../services/leads";
import { runAction } from "./run";

export async function createLeadAction(input: unknown) {
  return runAction(createLeadSchema, input, (data, ctx) => leads.createLead(ctx, data));
}

export async function updateLeadAction(input: unknown) {
  return runAction(updateLeadSchema, input, (data, ctx) => leads.updateLead(ctx, data));
}

export async function changeLeadStatusAction(input: unknown) {
  return runAction(changeLeadStatusSchema, input, (data, ctx) => leads.changeLeadStatus(ctx, data));
}

export async function changeLeadPriorityAction(input: unknown) {
  return runAction(changeLeadPrioritySchema, input, (data, ctx) => leads.changeLeadPriority(ctx, data));
}

export async function scheduleFollowUpAction(input: unknown) {
  return runAction(scheduleFollowUpSchema, input, (data, ctx) => leads.scheduleFollowUp(ctx, data));
}

export async function completeFollowUpAction(input: unknown) {
  return runAction(completeFollowUpSchema, input, (data, ctx) => leads.completeFollowUp(ctx, data));
}

export async function clearFollowUpAction(input: unknown) {
  return runAction(clearFollowUpSchema, input, (data, ctx) => leads.clearFollowUp(ctx, data));
}

export async function addLeadNoteAction(input: unknown) {
  return runAction(addLeadNoteSchema, input, (data, ctx) => leads.addLeadNote(ctx, data));
}

export async function logLeadContactAction(input: unknown) {
  return runAction(logLeadContactSchema, input, (data, ctx) => leads.logLeadContact(ctx, data));
}

export async function deleteLeadAction(input: unknown) {
  return runAction(deleteLeadSchema, input, (data, ctx) => leads.deleteLead(ctx, data));
}
