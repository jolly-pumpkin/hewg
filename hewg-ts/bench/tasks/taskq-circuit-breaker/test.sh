#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. circuit-breaker.ts exists
if [ ! -f src/workers/circuit-breaker.ts ]; then
  echo "FAIL: src/workers/circuit-breaker.ts does not exist"
  FAIL=1
fi

# 2. CircuitBreaker is exported
if ! grep -q 'export.*CircuitBreaker' src/workers/circuit-breaker.ts; then
  echo "FAIL: CircuitBreaker not exported from src/workers/circuit-breaker.ts"
  FAIL=1
fi

# 3. http-worker.ts imports from ./circuit-breaker
if ! grep -q "from.*['\"]\.\/circuit-breaker['\"]" src/workers/http-worker.ts; then
  echo "FAIL: src/workers/http-worker.ts does not import from ./circuit-breaker"
  FAIL=1
fi

# 4. webhook-worker.ts imports from ./circuit-breaker
if ! grep -q "from.*['\"]\.\/circuit-breaker['\"]" src/workers/webhook-worker.ts; then
  echo "FAIL: src/workers/webhook-worker.ts does not import from ./circuit-breaker"
  FAIL=1
fi

# 5. No changes to src/transforms/ files — check key exports still present
for f in src/transforms/*.ts; do
  if [ -f "$f" ]; then
    if ! grep -q 'export' "$f"; then
      echo "FAIL: exports missing or altered in $f"
      FAIL=1
    fi
  fi
done

# 6. No changes to src/types/ files — check key exports still present
for f in src/types/*.ts; do
  if [ -f "$f" ]; then
    if ! grep -q 'export' "$f"; then
      echo "FAIL: exports missing or altered in $f"
      FAIL=1
    fi
  fi
done

# 7. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
