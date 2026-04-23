/**
 *
 * Billing plan, usage tracking, and invoice types.
 */

/**
 * Create a branded BillingPlanId from a raw string.
 */
export function toBillingPlanId(raw: string): BillingPlanId {
  return raw as BillingPlanId;
}

/**
 * Compute the overage job count given a usage record and plan.
 * Returns zero when usage is within the included allowance.
 */
export function computeOverageJobs(
  usage: UsageRecord,
  plan: BillingPlan,
): number {
  const overage = usage.jobsCompleted - plan.includedJobs;
  return overage > 0 ? overage : 0;
}

/**
 * Build a complete Invoice from a usage record and plan.
 */
export function buildInvoice(
  usage: UsageRecord,
  plan: BillingPlan,
): Invoice {
  const overageJobs = computeOverageJobs(usage, plan);
  const overageCost = overageJobs * plan.pricePerJob;
  const baseCost = plan.includedJobs * plan.pricePerJob;
  const totalCost = baseCost + overageCost;

  return {
    tenantId: usage.tenantId,
    period: usage.period,
    plan,
    usage,
    includedJobs: plan.includedJobs,
    overageJobs,
    overageCost,
    totalCost,
  };
}
