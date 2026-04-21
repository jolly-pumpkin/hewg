#!/usr/bin/env bash
# Ground-truth check for inject-http-client.
# Exit 0 iff the task is complete.
set -u

PRICES="src/prices.ts"
TYPES="src/types.ts"

if [ ! -f "$PRICES" ]; then
  echo "missing $PRICES" >&2
  exit 1
fi

# 1. syncPrices must still be exported.
if ! grep -q 'export.*function syncPrices\|export.*syncPrices' "$PRICES"; then
  echo "syncPrices export not found" >&2
  exit 1
fi

# 2. syncPrices must accept an http/client parameter.
if ! grep -qE 'syncPrices\s*\([^)]*\b(http|client|httpClient)\b' "$PRICES"; then
  echo "syncPrices does not accept an http/client parameter" >&2
  exit 1
fi

# 3. Must NOT call fetch directly in prices.ts.
# Allow the word "fetch" only in comments or type references, not as a call.
if grep -qE '(await\s+fetch\s*\(|(^|[^a-zA-Z])fetch\s*\()' "$PRICES"; then
  echo "direct fetch() call still present in $PRICES" >&2
  exit 1
fi

# 4. An HttpClient type must be exported from types.ts.
if ! grep -qE 'export.*(type|interface)\s+HttpClient' "$TYPES"; then
  echo "HttpClient type not exported from $TYPES" >&2
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
