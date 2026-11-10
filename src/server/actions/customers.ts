"use server";

import { createCustomerSchema, deleteCustomerSchema, mergeCustomersSchema, updateCustomerSchema } from "@/domain/schemas/customer";
import * as customers from "../services/customers";
import { runAction } from "./run";

export async function createCustomerAction(input: unknown) {
  return runAction(createCustomerSchema, input, (data, ctx) => customers.createCustomer(ctx, data));
}

export async function updateCustomerAction(input: unknown) {
  return runAction(updateCustomerSchema, input, (data, ctx) => customers.updateCustomer(ctx, data));
}

export async function deleteCustomerAction(input: unknown) {
  return runAction(deleteCustomerSchema, input, (data, ctx) => customers.deleteCustomer(ctx, data));
}

export async function mergeCustomersAction(input: unknown) {
  return runAction(mergeCustomersSchema, input, (data, ctx) => customers.mergeCustomers(ctx, data));
}
