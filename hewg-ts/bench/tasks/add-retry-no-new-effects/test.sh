#!/usr/bin/env bash
# Ground-truth check for add-retry-no-new-effects.
# Exit 0 iff the task is complete.
set -u

FILE="src/api.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must still export fetchUser with the same signature.
if ! grep -q 'export async function fetchUser' "$FILE"; then
  echo "fetchUser export not found" >&2
  exit 1
fi

# 2. Must contain retry logic — look for a loop or retry counter.
if ! grep -qE '(for\s*\(|while\s*\(|retries|attempts|retry|tries)' "$FILE"; then
  echo "no retry logic detected" >&2
  exit 1
fi

# 3. Must NOT use console.log, console.warn, console.error (no logging).
if grep -qE 'console\.(log|warn|error|info|debug)' "$FILE"; then
  echo "forbidden: console logging detected in $FILE" >&2
  exit 1
fi

# 4. Must NOT use setTimeout or sleep (no delays).
if grep -qE '(setTimeout\s*\(|setInterval\s*\(|(^|[^a-zA-Z])sleep\s*\(|(^|[^a-zA-Z])delay\s*\()' "$FILE"; then
  echo "forbidden: timer/sleep detected in $FILE" >&2
  exit 1
fi

# 5. Must NOT import from util.ts.
if grep -qE "from.*['\"]\.\/util" "$FILE"; then
  echo "forbidden: import from util.ts detected" >&2
  exit 1
fi

# 6. Must NOT use fs (no file writes).
if grep -qE "(require.*['\"]fs['\"]|from.*['\"]fs['\"]|from.*['\"]node:fs['\"])" "$FILE"; then
  echo "forbidden: fs import detected in $FILE" >&2
  exit 1
fi

# 7. Type-check passes (if tsc is available in PATH).
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
