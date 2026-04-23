/**
 * @hewg-module taskq/billing/plan-calculator
 *
 * Pure arithmetic helpers for billing plan cost calculations.
 */

import type { BillingPlan, UsageRecord } from "../types/billing";

/**
 * Calculate the cost for the next job given a plan and the tenant's
 * current usage count. Returns 0 when usage is still within the
 * included allowance; otherwise returns the per-job overage price.
 *
 * @hewg-module taskq/billing/plan-calculator
 * @effects
 */
export function calculateJobCost(
  plan: BillingPlan,
  currentUsage: number,
): number {
  if (currentUsage < plan.includedJobs) {
    return 0;
  }
  return plan.pricePerJob;
}

/**
 * Compute the total monthly bill for a tenant given their plan and
 * actual usage record. Included jobs are billed at the per-job rate
 * and overage jobs are added on top.
 *
 * @hewg-module taskq/billing/plan-calculator
 * @effects
 */
export function calculateMonthlyTotal(
  plan: BillingPlan,
  usage: UsageRecord,
): number {
  const baseCost = plan.includedJobs * plan.pricePerJob;
  const overage = Math.max(0, usage.jobsCompleted - plan.includedJobs);
  const overageCost = overage * plan.pricePerJob;
  return baseCost + overageCost;
}

/**
 * Project the estimated monthly bill based on a daily submission rate
 * and the number of days in the billing period. Useful for budget
 * forecasting dashboards.
 *
 * @hewg-module taskq/billing/plan-calculator
 * @effects
 */
export function estimateMonthlyBill(
  plan: BillingPlan,
  dailyRate: number,
  daysInMonth: number,
): number {
  const projectedJobs = dailyRate * daysInMonth;
  const baseCost = plan.includedJobs * plan.pricePerJob;
  const overage = Math.max(0, projectedJobs - plan.includedJobs);
  const overageCost = overage * plan.pricePerJob;
  return baseCost + overageCost;
}

/**
 * Check whether a tenant's current usage is still within the plan's
 * included job quota. Returns true when they have remaining capacity.
 *
 * @hewg-module taskq/billing/plan-calculator
 * @effects
 */
export function isWithinQuota(
  plan: BillingPlan,
  currentUsage: number,
): boolean {
  return currentUsage < plan.includedJobs;
}
