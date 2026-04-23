#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. fetchWeather still exists and is exported
if ! grep -q 'export async function fetchWeather' src/api/client.ts; then
  echo "FAIL: fetchWeather export not found in src/api/client.ts"
  FAIL=1
fi

# 2. Retry pattern detected (loop or counter)
if ! grep -qE '(for\s*\(|while\s*\(|retries|attempts|retry|maxRetries|MAX_RETRIES)' src/api/client.ts; then
  echo "FAIL: no retry loop/counter pattern found in src/api/client.ts"
  FAIL=1
fi

# 3. No console.log/warn/error in client.ts
if grep -qE 'console\.(log|warn|error)\(' src/api/client.ts; then
  echo "FAIL: console output found in src/api/client.ts"
  FAIL=1
fi

# 4. No setTimeout/sleep/delay in client.ts
if grep -qE '(setTimeout|sleep|delay|setInterval)\(' src/api/client.ts; then
  echo "FAIL: timer/delay found in src/api/client.ts"
  FAIL=1
fi

# 5. transform.ts is unchanged — check key function signature is still present
if ! grep -q 'export function transformResponse' src/api/transform.ts; then
  echo "FAIL: transformResponse signature missing or altered in src/api/transform.ts"
  FAIL=1
fi

# 6. Function signature unchanged
if ! grep -qE 'async function fetchWeather\(' src/api/client.ts; then
  echo "FAIL: fetchWeather signature changed"
  FAIL=1
fi

# 7. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
