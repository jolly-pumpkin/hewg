/**
 *
 * Tracks job lifecycle events against tenant usage records in the
 * database. Each event increments the appropriate counter on the
 * current billing period's usage record.
 */

import type { Database } from "../storage/connection";
import type { TenantId } from "../types/tenant";
import type { UsageRecord } from "../types/billing";
import {
  getUsageRecord,
  incrementJobCount,
  upsertUsageRecord,
} from "../storage/billing";

/**
 * Derive the current billing period string (YYYY-MM) from the
 * current date.
 *
 */
function currentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Record that a tenant has submitted a new job. Increments the
 * jobsSubmitted counter for the current billing period.
 *
 */
export function trackJobSubmission(db: Database, tenantId: TenantId): void {
  const period = currentPeriod();
  incrementJobCount(db, tenantId, period, "jobsSubmitted");
}

/**
 * Record that a tenant's job completed successfully. Increments
 * the jobsCompleted counter and accumulates processing duration.
 *
 */
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

/**
 * Record that a tenant's job has failed. Increments the jobsFailed
 * counter for the current billing period.
 *
 */
export function trackJobFailure(db: Database, tenantId: TenantId): void {
  const period = currentPeriod();
  incrementJobCount(db, tenantId, period, "jobsFailed");
}

/**
 * Retrieve the current billing period's usage record for a tenant,
 * or null if no usage has been recorded yet.
 *
 */
export function getCurrentUsage(
  db: Database,
  tenantId: TenantId,
): UsageRecord | null {
  const period = currentPeriod();
  return getUsageRecord(db, tenantId, period);
}
