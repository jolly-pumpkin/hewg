/**
 * @hewg-module taskq/types/billing
 *
 * Billing plan, usage tracking, and invoice types.
 */

/** Branded string type for billing plan identifiers. */
export type BillingPlanId = string & { readonly __brand: "BillingPlanId" };

/** Definition of a billing plan tier. */
export interface BillingPlan {
  readonly id: BillingPlanId;
  readonly name: string;
  readonly maxJobsPerHour: number;
  readonly maxConcurrentJobs: number;
  readonly maxPayloadBytes: number;
  readonly pricePerJob: number;
  readonly includedJobs: number;
}

/** Aggregated usage for a tenant over a billing period. */
export interface UsageRecord {
  readonly tenantId: string;
  readonly period: string;
  jobsSubmitted: number;
  jobsCompleted: number;
  jobsFailed: number;
  totalDurationMs: number;
}

/** A computed invoice for a single billing period. */
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

/**
 * Create a branded BillingPlanId from a raw string.
 * @hewg-module taskq/types/billing
 * @effects
 */
export function toBillingPlanId(raw: string): BillingPlanId {
  return raw as BillingPlanId;
}

/**
 * Compute the overage job count given a usage record and plan.
 * Returns zero when usage is within the included allowance.
 * @hewg-module taskq/types/billing
 * @effects
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
 * @hewg-module taskq/types/billing
 * @effects
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
