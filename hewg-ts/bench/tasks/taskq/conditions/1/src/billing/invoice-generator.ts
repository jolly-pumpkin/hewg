
import type { Database } from "../storage/connection";
import type { TenantId } from "../types/tenant";
import type { BillingPlan, Invoice, UsageRecord } from "../types/billing";
import { getUsageRecord, listUsageRecords, upsertUsageRecord } from "../storage/billing";
import { readDataFile, writeDataFile } from "../storage/connection";

export function generateInvoice(
  db: Database,
  tenantId: TenantId,
  plan: BillingPlan,
  period: string,
): Invoice | null {
  const usage = getUsageRecord(db, tenantId, period);
  if (!usage) {
    return null;
  }

  const overageJobs = Math.max(0, usage.jobsCompleted - plan.includedJobs);
  const baseCost = plan.includedJobs * plan.pricePerJob;
  const overageCost = overageJobs * plan.pricePerJob;
  const totalCost = baseCost + overageCost;

  return {
    tenantId: tenantId as string,
    period,
    plan,
    usage,
    includedJobs: plan.includedJobs,
    overageJobs,
    overageCost,
    totalCost,
  };
}

export function saveInvoice(db: Database, invoice: Invoice): void {
  const data = readDataFile(db);
  const key = `invoice::${invoice.tenantId}::${invoice.period}`;
  (data as unknown as Record<string, unknown>)[key] = invoice;
  writeDataFile(db, data);
}

export function listInvoices(db: Database, tenantId: TenantId): Invoice[] {
  const data = readDataFile(db) as unknown as Record<string, unknown>;
  const prefix = `invoice::${tenantId as string}::`;
  const invoices: Invoice[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(prefix)) {
      invoices.push(value as Invoice);
    }
  }

  return invoices;
}
