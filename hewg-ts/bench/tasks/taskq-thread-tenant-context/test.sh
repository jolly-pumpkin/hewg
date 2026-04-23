#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. QueueManager in manager.ts has a method signature containing TenantContext
if ! grep -q 'TenantContext' src/queue/manager.ts; then
  echo "FAIL: TenantContext not found in src/queue/manager.ts"
  FAIL=1
fi

# 2. manager.ts imports TenantContext from types
if ! grep -qE "import.*TenantContext.*from.*(../types|../types/tenant)" src/queue/manager.ts; then
  echo "FAIL: TenantContext import not found in src/queue/manager.ts"
  FAIL=1
fi

# 3. workers/pool.ts references TenantContext
if ! grep -q 'TenantContext' src/workers/pool.ts; then
  echo "FAIL: TenantContext not found in src/workers/pool.ts"
  FAIL=1
fi

# 4. api/jobs.ts passes tenant context when calling queue methods
if ! grep -qE '(ctx|tenantContext)' src/api/jobs.ts | grep -qE '(submitJob|queue)'; then
  # Fallback: just check that tenantContext or ctx appears near submit calls
  if ! grep -qE '(tenantContext|ctx)' src/api/jobs.ts; then
    echo "FAIL: tenant context not passed in src/api/jobs.ts"
    FAIL=1
  fi
fi

# 5. transforms/ files are unchanged — check key exports still present
if ! grep -q 'export' src/transforms/priority.ts; then
  echo "FAIL: src/transforms/priority.ts exports missing or altered"
  FAIL=1
fi

if ! grep -q 'export' src/transforms/payload.ts; then
  echo "FAIL: src/transforms/payload.ts exports missing or altered"
  FAIL=1
fi

# 6. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
