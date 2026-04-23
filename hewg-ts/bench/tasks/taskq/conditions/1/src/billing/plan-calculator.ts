
import type { BillingPlan, UsageRecord } from "../types/billing";

export function calculateJobCost(
  plan: BillingPlan,
  currentUsage: number,
): number {
  if (currentUsage < plan.includedJobs) {
    return 0;
  }
  return plan.pricePerJob;
}

export function calculateMonthlyTotal(
  plan: BillingPlan,
  usage: UsageRecord,
): number {
  const baseCost = plan.includedJobs * plan.pricePerJob;
  const overage = Math.max(0, usage.jobsCompleted - plan.includedJobs);
  const overageCost = overage * plan.pricePerJob;
  return baseCost + overageCost;
}

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

export function isWithinQuota(
  plan: BillingPlan,
  currentUsage: number,
): boolean {
  return currentUsage < plan.includedJobs;
}
