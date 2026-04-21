#!/usr/bin/env bash
# Ground-truth check for add-error-variant.
# Exit 0 iff the task is complete.
set -u

RESULT="src/result.ts"
USER_SVC="src/user-service.ts"
ORDER_SVC="src/order-service.ts"
HANDLER="src/handler.ts"

# 1. Result type must contain rate_limited variant.
if ! grep -q 'rate_limited' "$RESULT"; then
  echo "rate_limited variant not found in $RESULT" >&2
  exit 1
fi

# 2. retryAfterMs field must exist in the variant.
if ! grep -q 'retryAfterMs' "$RESULT"; then
  echo "retryAfterMs field not found in $RESULT" >&2
  exit 1
fi

# 3. A rateLimited constructor must be exported.
if ! grep -q 'export function rateLimited' "$RESULT"; then
  echo "rateLimited constructor not exported from $RESULT" >&2
  exit 1
fi

# 4. handler.ts must handle rate_limited for both results.
HANDLER_RATE_COUNT=$(grep -c 'rate_limited' "$HANDLER" || true)
if [ "$HANDLER_RATE_COUNT" -lt 2 ]; then
  echo "handler.ts must handle rate_limited in both switch blocks (found $HANDLER_RATE_COUNT)" >&2
  exit 1
fi

# 5. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
