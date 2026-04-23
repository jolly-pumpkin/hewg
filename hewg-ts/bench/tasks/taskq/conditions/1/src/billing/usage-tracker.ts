
import type { Database } from "../storage/connection";
import type { TenantId } from "../types/tenant";
import type { UsageRecord } from "../types/billing";
import {
  getUsageRecord,
  incrementJobCount,
  upsertUsageRecord,
} from "../storage/billing";

function currentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function trackJobSubmission(db: Database, tenantId: TenantId): void {
  const period = currentPeriod();
  incrementJobCount(db, tenantId, period, "jobsSubmitted");
}

export function trackJobCompletion(
  db: Database,
  tenantId: TenantId,
  durationMs: number,
): void {
  const period = currentPeriod();
  incrementJobCount(db, tenantId, period, "jobsCompleted");

  const record = getUsageRecord(db, tenantId, period);
  if (record) {
    const updated: UsageRecord = {
      ...record,
      totalDurationMs: record.totalDurationMs + durationMs,
    };
    upsertUsageRecord(db, updated);
  }
}

export function trackJobFailure(db: Database, tenantId: TenantId): void {
  const period = currentPeriod();
  incrementJobCount(db, tenantId, period, "jobsFailed");
}

export function getCurrentUsage(
  db: Database,
  tenantId: TenantId,
): UsageRecord | null {
  const period = currentPeriod();
  return getUsageRecord(db, tenantId, period);
}
