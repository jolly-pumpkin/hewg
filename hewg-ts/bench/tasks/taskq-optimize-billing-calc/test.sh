#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. plan-calculator.ts exports buildTierLookup
if ! grep -q 'export.*buildTierLookup' src/billing/plan-calculator.ts; then
  echo "FAIL: buildTierLookup export not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

# 2. plan-calculator.ts exports cachedCalculateJobCost
if ! grep -q 'export.*cachedCalculateJobCost' src/billing/plan-calculator.ts; then
  echo "FAIL: cachedCalculateJobCost export not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

# 3. Original functions still exist
if ! grep -q 'calculateJobCost' src/billing/plan-calculator.ts; then
  echo "FAIL: calculateJobCost not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

if ! grep -q 'calculateMonthlyTotal' src/billing/plan-calculator.ts; then
  echo "FAIL: calculateMonthlyTotal not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

if ! grep -q 'estimateMonthlyBill' src/billing/plan-calculator.ts; then
  echo "FAIL: estimateMonthlyBill not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

if ! grep -q 'isWithinQuota' src/billing/plan-calculator.ts; then
  echo "FAIL: isWithinQuota not found in src/billing/plan-calculator.ts"
  FAIL=1
fi

# 4. No other files were modified — check key exports in other modules
if ! grep -q 'export' src/queue/manager.ts; then
  echo "FAIL: src/queue/manager.ts exports missing or altered"
  FAIL=1
fi

if ! grep -q 'export' src/api/jobs.ts; then
  echo "FAIL: src/api/jobs.ts exports missing or altered"
  FAIL=1
fi

if ! grep -q 'export' src/transforms/priority.ts; then
  echo "FAIL: src/transforms/priority.ts exports missing or altered"
  FAIL=1
fi

# 5. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
