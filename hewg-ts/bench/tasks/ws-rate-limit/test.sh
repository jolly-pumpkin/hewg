#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. RateLimitError exists in types.ts
if ! grep -q 'class RateLimitError' src/types.ts; then
  echo "FAIL: RateLimitError class not found in src/types.ts"
  FAIL=1
fi

# 2. RateLimitError has retryAfterMs
if ! grep -q 'retryAfterMs' src/types.ts; then
  echo "FAIL: retryAfterMs field not found in src/types.ts"
  FAIL=1
fi

# 3. client.ts handles 429
if ! grep -q '429' src/api/client.ts; then
  echo "FAIL: 429 status not handled in src/api/client.ts"
  FAIL=1
fi

# 4. client.ts uses RateLimitError
if ! grep -q 'RateLimitError' src/api/client.ts; then
  echo "FAIL: RateLimitError not used in src/api/client.ts"
  FAIL=1
fi

# 5. client.ts parses Retry-After header
if ! grep -qiE 'retry.after' src/api/client.ts; then
  echo "FAIL: Retry-After header not parsed in src/api/client.ts"
  FAIL=1
fi

# 6. sync.ts references RateLimitError
if ! grep -q 'RateLimitError' src/services/sync.ts; then
  echo "FAIL: RateLimitError not handled in src/services/sync.ts"
  FAIL=1
fi

# 7. fetch.ts handles rate-limit errors
if ! grep -qEi '(RateLimitError|rate.limit|retryAfter)' src/commands/fetch.ts; then
  echo "FAIL: rate-limit handling not found in src/commands/fetch.ts"
  FAIL=1
fi

# 8. Pure files unchanged
for f in src/api/transform.ts src/services/analytics.ts src/services/alerts.ts src/output/table.ts; do
  if grep -q 'RateLimitError' "$f" 2>/dev/null; then
    echo "FAIL: RateLimitError leaked into pure file $f"
    FAIL=1
  fi
done

# 9. TypeScript check
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
