/**
 * @hewg-module taskq/billing/rate-limit-checker
 *
 * Checks whether a tenant is within their plan's rate limits before
 * allowing job submission. Reads from the database and system clock.
 */

import type { Database } from "../storage/connection";
import type { TenantId } from "../types/tenant";
import type { BillingPlan } from "../types/billing";
import { getUsageRecord } from "../storage/billing";

/** Result of a rate-limit check for a single tenant submission. */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly remainingJobs: number;
  readonly resetAt: Date;
}

/**
 * Derive the current billing period string (YYYY-MM) from today.
 */
function currentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Compute the start of the next billing period (first of next month).
 */
function nextPeriodStart(): Date {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  return new Date(year, month, 1);
}

/**
 * Check whether a tenant is allowed to submit another job given
 * their plan's hourly and monthly limits. Reads the current usage
 * record from the database and checks against the plan's
 * maxJobsPerHour and included job quota.
 *
 * @hewg-module taskq/billing/rate-limit-checker
 * @effects fs.read, time.read
 */
export function checkRateLimit(
  db: Database,
  tenantId: TenantId,
  plan: BillingPlan,
): RateLimitResult {
  const period = currentPeriod();
  const usage = getUsageRecord(db, tenantId, period);
  const resetAt = nextPeriodStart();

  if (!usage) {
    return {
      allowed: true,
      remainingJobs: plan.maxJobsPerHour,
      resetAt,
    };
  }

  const totalSubmitted = usage.jobsSubmitted;
  const maxMonthly = plan.includedJobs * 2;

  if (totalSubmitted >= maxMonthly) {
    return {
      allowed: false,
      reason: `Monthly submission cap of ${maxMonthly} reached`,
      remainingJobs: 0,
      resetAt,
    };
  }

  const now = Date.now();
  const hourStart = now - 3_600_000;
  const hourlyRemaining = Math.max(0, plan.maxJobsPerHour - totalSubmitted);

  if (hourlyRemaining <= 0) {
    return {
      allowed: false,
      reason: `Hourly rate limit of ${plan.maxJobsPerHour} jobs exceeded`,
      remainingJobs: 0,
      resetAt: new Date(hourStart + 3_600_000),
    };
  }

  return {
    allowed: true,
    remainingJobs: Math.min(hourlyRemaining, maxMonthly - totalSubmitted),
    resetAt,
  };
}
