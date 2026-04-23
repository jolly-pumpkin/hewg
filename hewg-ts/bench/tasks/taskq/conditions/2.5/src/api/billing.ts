/**
 *
 * HTTP handler functions for billing and usage endpoints. Reads
 * usage records and invoices scoped to the authenticated tenant.
 */

import type { Database } from "../storage/connection";
import type { TenantContext } from "../types/tenant";
import { getUsageRecord, listUsageRecords } from "../storage/billing";
import { listInvoices, generateInvoice } from "../billing/invoice-generator";
import { getTenant } from "../storage/tenants";
import type { ApiResponse } from "./jobs";

/**
 * Derive a billing plan stub from the tenant context. In a real
 * system this would look up the full plan from a plans table.
 */
function defaultPlan() {
  return {
    id: "default" as import("../types/billing").BillingPlanId,
    name: "Default",
    maxJobsPerHour: 100,
    maxConcurrentJobs: 10,
    maxPayloadBytes: 1_048_576,
    pricePerJob: 0.01,
    includedJobs: 1000,
  };
}

/**
 * Handle a GET /billing/usage request. Returns the usage record for
 * the authenticated tenant in the specified billing period.
 *
 */
export function handleGetUsage(
  db: Database,
  ctx: TenantContext,
  period: string,
): ApiResponse {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return { status: 400, body: { error: "Invalid period format, expected YYYY-MM" } };
  }

  const usage = getUsageRecord(db, ctx.tenantId, period);
  if (!usage) {
    console.log(`[api/billing] No usage found for tenant ${ctx.tenantId} period ${period}`);
    return { status: 404, body: { error: "No usage record for this period" } };
  }

  console.log(`[api/billing] Retrieved usage for tenant ${ctx.tenantId} period ${period}`);
  return { status: 200, body: usage };
}

/**
 * Handle a GET /billing/invoices/:period request. Generates an
 * invoice for the authenticated tenant and the given period.
 * Returns 404 if no usage exists.
 *
 */
export function handleGetInvoice(
  db: Database,
  ctx: TenantContext,
  period: string,
): ApiResponse {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return { status: 400, body: { error: "Invalid period format, expected YYYY-MM" } };
  }

  const plan = defaultPlan();
  const invoice = generateInvoice(db, ctx.tenantId, plan, period);

  if (!invoice) {
    console.log(`[api/billing] No invoice data for tenant ${ctx.tenantId} period ${period}`);
    return { status: 404, body: { error: "No usage data for this period" } };
  }

  console.log(`[api/billing] Generated invoice for tenant ${ctx.tenantId} period ${period}`);
  return { status: 200, body: invoice };
}

/**
 * Handle a GET /billing/invoices request. Lists all invoices
 * for the authenticated tenant across all billing periods.
 *
 */
export function handleListInvoices(
  db: Database,
  ctx: TenantContext,
): ApiResponse {
  const invoices = listInvoices(db, ctx.tenantId);
  console.log(`[api/billing] Listed ${invoices.length} invoices for tenant ${ctx.tenantId}`);
  return { status: 200, body: invoices };
}
