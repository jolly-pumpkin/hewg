
export type BillingPlanId = string & { readonly __brand: "BillingPlanId" };

export interface BillingPlan {
  readonly id: BillingPlanId;
  readonly name: string;
  readonly maxJobsPerHour: number;
  readonly maxConcurrentJobs: number;
  readonly maxPayloadBytes: number;
  readonly pricePerJob: number;
  readonly includedJobs: number;
}

export interface UsageRecord {
  readonly tenantId: string;
  readonly period: string;
  jobsSubmitted: number;
  jobsCompleted: number;
  jobsFailed: number;
  totalDurationMs: number;
}

export interface Invoice {
  readonly tenantId: string;
  readonly period: string;
  readonly plan: BillingPlan;
  readonly usage: UsageRecord;
  readonly includedJobs: number;
  readonly overageJobs: number;
  readonly overageCost: number;
  readonly totalCost: number;
}

export function toBillingPlanId(raw: string): BillingPlanId {
  return raw as BillingPlanId;
}

export function computeOverageJobs(
  usage: UsageRecord,
  plan: BillingPlan,
): number {
  const overage = usage.jobsCompleted - plan.includedJobs;
  return overage > 0 ? overage : 0;
}

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
