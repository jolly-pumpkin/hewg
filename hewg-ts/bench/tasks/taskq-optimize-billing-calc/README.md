# Task: Optimize Billing Calculation with Memoized Tier Lookup

## Context

This is a multi-tenant task queue service. The billing plan calculator (`src/billing/plan-calculator.ts`) is called on every job submission to check quotas and compute costs. Currently it recomputes the cost tier from scratch each time.

## Task

Optimize the billing calculation to avoid redundant computation.

1. In `src/billing/plan-calculator.ts`, add a `BillingTierCache` that maps `(planId, usageCount)` ranges to pre-computed cost tiers. This avoids recalculating whether a job is within quota or overage on every call.
2. Add a `buildTierLookup(plan: BillingPlan): TierLookup` function that pre-computes the cost for usage ranges (e.g., 0-includedJobs = 0 cost, includedJobs+ = pricePerJob).
3. Add a `cachedCalculateJobCost(lookup: TierLookup, currentUsage: number): number` function that uses the pre-computed lookup.
4. The existing `calculateJobCost`, `calculateMonthlyTotal`, `estimateMonthlyBill`, and `isWithinQuota` functions must remain unchanged — this is purely additive.
5. All new functions must be pure — no IO, no side effects.
6. Do NOT modify any files outside `src/billing/plan-calculator.ts`.

## Verification

Run `bash test.sh`
