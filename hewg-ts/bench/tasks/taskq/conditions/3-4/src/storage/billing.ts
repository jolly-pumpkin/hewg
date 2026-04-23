/**
 * @hewg-module taskq/storage/billing
 *
 * Usage-record persistence for tenant billing in the simulated
 * JSON-file database.
 */

import type { UsageRecord } from "../types/billing";
import type { TenantId } from "../types/tenant";
import type { Database } from "./connection";
import { readDataFile, writeDataFile } from "./connection";

/**
 * Build a composite key for a usage record from tenant + period.
 *
 * @hewg-module taskq/storage/billing
 * @effects
 */
export function usageKey(tenantId: TenantId, period: string): string {
  return `${tenantId as string}::${period}`;
}

/**
 * Retrieve the usage record for a tenant in a specific billing period,
 * or null if none exists yet.
 *
 * @hewg-module taskq/storage/billing
 * @effects fs.read
 */
export function getUsageRecord(
  db: Database,
  tenantId: TenantId,
  period: string,
): UsageRecord | null {
  const data = readDataFile(db);
  const key = usageKey(tenantId, period);
  const record = data.usage[key];
  return (record as UsageRecord) ?? null;
}

/**
 * Insert or replace a usage record in the database.
 *
 * @hewg-module taskq/storage/billing
 * @effects fs.read, fs.write
 */
export function upsertUsageRecord(db: Database, record: UsageRecord): void {
  const data = readDataFile(db);
  const key = `${record.tenantId}::${record.period}`;
  data.usage[key] = record;
  writeDataFile(db, data);
}

/**
 * Atomically increment one of the job-count fields on a usage record.
 * Creates the record if it does not yet exist for the given period.
 *
 * @hewg-module taskq/storage/billing
 * @effects fs.read, fs.write
 */
export function incrementJobCount(
  db: Database,
  tenantId: TenantId,
  period: string,
  field: "jobsSubmitted" | "jobsCompleted" | "jobsFailed",
): void {
  const data = readDataFile(db);
  const key = usageKey(tenantId, period);
  let record = data.usage[key] as UsageRecord | undefined;

  if (!record) {
    record = {
      tenantId: tenantId as string,
      period,
      jobsSubmitted: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      totalDurationMs: 0,
    };
  }

  record[field] += 1;
  data.usage[key] = record;
  writeDataFile(db, data);
}

/**
 * List all usage records for a tenant across all billing periods.
 *
 * @hewg-module taskq/storage/billing
 * @effects fs.read
 */
export function listUsageRecords(
  db: Database,
  tenantId: TenantId,
): UsageRecord[] {
  const data = readDataFile(db);
  return Object.values(data.usage)
    .filter((r) => (r as UsageRecord).tenantId === (tenantId as string))
    .map((r) => r as UsageRecord);
}
