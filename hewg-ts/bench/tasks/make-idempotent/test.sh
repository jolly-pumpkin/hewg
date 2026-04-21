#!/usr/bin/env bash
# Ground-truth check for make-idempotent.
# Exit 0 iff the task is complete.
set -u

FILE="src/orders.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must still export processOrder.
if ! grep -q 'export.*function processOrder\|export.*processOrder' "$FILE"; then
  echo "processOrder export not found" >&2
  exit 1
fi

# 2. Must check for existing receipt (using receiptExists or loadReceipt from db).
if ! grep -qE '(receiptExists|loadReceipt)' "$FILE"; then
  echo "no idempotency check found (expected receiptExists or loadReceipt)" >&2
  exit 1
fi

# 3. Must import from db.ts (to use the check function).
if ! grep -qE "from.*['\"]\.\/db" "$FILE"; then
  echo "no import from db.ts found" >&2
  exit 1
fi

# 4. Must NOT use console.log (no logging).
if grep -qE 'console\.(log|warn|error|info|debug)' "$FILE"; then
  echo "forbidden: console logging detected in $FILE" >&2
  exit 1
fi

# 5. Must NOT use setTimeout or sleep (no delays).
if grep -qE '(setTimeout\s*\(|setInterval\s*\(|(^|[^a-zA-Z])sleep\s*\(|(^|[^a-zA-Z])delay\s*\()' "$FILE"; then
  echo "forbidden: timer/sleep detected in $FILE" >&2
  exit 1
fi

# 6. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
