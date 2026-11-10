"use server";

import {
  changeOperatorStatusSchema,
  createOperatorSchema,
  deleteComplianceSchema,
  deleteOperatorSchema,
  deleteVehicleSchema,
  updateOperatorSchema,
  upsertComplianceSchema,
  upsertVehicleSchema,
} from "@/domain/schemas/operator";
import * as operators from "../services/operators";
import { runAction } from "./run";

export async function createOperatorAction(input: unknown) {
  return runAction(createOperatorSchema, input, (data, ctx) => operators.createOperator(ctx, data));
}

export async function updateOperatorAction(input: unknown) {
  return runAction(updateOperatorSchema, input, (data, ctx) => operators.updateOperator(ctx, data));
}

export async function changeOperatorStatusAction(input: unknown) {
  return runAction(changeOperatorStatusSchema, input, (data, ctx) => operators.changeOperatorStatus(ctx, data));
}

export async function deleteOperatorAction(input: unknown) {
  return runAction(deleteOperatorSchema, input, (data, ctx) => operators.deleteOperator(ctx, data));
}

export async function upsertVehicleAction(input: unknown) {
  return runAction(upsertVehicleSchema, input, (data, ctx) => operators.upsertVehicle(ctx, data));
}

export async function deleteVehicleAction(input: unknown) {
  return runAction(deleteVehicleSchema, input, async (data, ctx) => {
    await operators.deleteVehicle(ctx, data);
    return null;
  });
}

export async function upsertComplianceAction(input: unknown) {
  return runAction(upsertComplianceSchema, input, (data, ctx) => operators.upsertCompliance(ctx, data));
}

export async function deleteComplianceAction(input: unknown) {
  return runAction(deleteComplianceSchema, input, async (data, ctx) => {
    await operators.deleteCompliance(ctx, data);
    return null;
  });
}
