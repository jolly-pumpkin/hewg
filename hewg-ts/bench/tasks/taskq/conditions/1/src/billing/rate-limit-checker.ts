
import type { Database } from "../storage/connection";
import type { TenantId } from "../types/tenant";
import type { BillingPlan } from "../types/billing";
import { getUsageRecord } from "../storage/billing";

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly remainingJobs: number;
  readonly resetAt: Date;
}

function currentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function nextPeriodStart(): Date {
  const now = new Date();
  const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  return new Date(year, month, 1);
}

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
