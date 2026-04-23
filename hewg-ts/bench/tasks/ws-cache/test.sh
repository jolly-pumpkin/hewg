#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. cache.ts exists
if [ ! -f src/api/cache.ts ]; then
  echo "FAIL: src/api/cache.ts does not exist"
  FAIL=1
fi

# 2. Required exports
if [ -f src/api/cache.ts ]; then
  if ! grep -q 'export function getCachedWeather' src/api/cache.ts; then
    echo "FAIL: getCachedWeather not exported from src/api/cache.ts"
    FAIL=1
  fi
  if ! grep -q 'export function setCachedWeather' src/api/cache.ts; then
    echo "FAIL: setCachedWeather not exported from src/api/cache.ts"
    FAIL=1
  fi
  if ! grep -q 'export function clearCache' src/api/cache.ts; then
    echo "FAIL: clearCache not exported from src/api/cache.ts"
    FAIL=1
  fi

  # 3. Cache is pure — no fs or fetch imports
  if grep -qE "(from ['\"]node:fs|from ['\"]fs|import.*fetch|require.*fs)" src/api/cache.ts; then
    echo "FAIL: src/api/cache.ts imports filesystem or fetch — should be pure"
    FAIL=1
  fi

  # 4. Uses Map for storage
  if ! grep -qE '(new Map|Map<)' src/api/cache.ts; then
    echo "FAIL: src/api/cache.ts doesn't use Map for caching"
    FAIL=1
  fi
fi

# 5. sync.ts imports from cache
if ! grep -qE "(from ['\"].*cache|import.*cache)" src/services/sync.ts; then
  echo "FAIL: src/services/sync.ts does not import from cache module"
  FAIL=1
fi

# 6. client.ts unchanged
if ! grep -q 'export async function fetchWeather' src/api/client.ts; then
  echo "FAIL: src/api/client.ts fetchWeather signature altered"
  FAIL=1
fi

# 7. transform.ts unchanged
if ! grep -q 'export function transformResponse' src/api/transform.ts; then
  echo "FAIL: src/api/transform.ts transformResponse signature altered"
  FAIL=1
fi

# 8. syncStation signature unchanged
if ! grep -q 'export async function syncStation' src/services/sync.ts; then
  echo "FAIL: syncStation signature missing"
  FAIL=1
fi

# 9. TypeScript check
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
