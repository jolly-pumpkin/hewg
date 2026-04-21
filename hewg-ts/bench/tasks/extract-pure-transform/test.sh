#!/usr/bin/env bash
# Ground-truth check for extract-pure-transform.
# Exit 0 iff the task is complete.
set -u

FILE="src/report.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must export renderHtml.
if ! grep -q 'export function renderHtml\|export.*renderHtml' "$FILE"; then
  echo "renderHtml not exported from $FILE" >&2
  exit 1
fi

# 2. renderHtml must accept config and data parameters (in either order).
if ! grep -qE 'renderHtml\s*\([^)]*(config|data)' "$FILE"; then
  echo "renderHtml does not accept config or data parameters" >&2
  exit 1
fi

# 3. renderHtml must return string (check return type annotation or infer).
if ! grep -qE 'renderHtml\s*\([^)]*\)\s*:\s*string' "$FILE"; then
  echo "renderHtml does not have string return type" >&2
  exit 1
fi

# 4. formatReport must still exist.
if ! grep -q 'export function formatReport\|export.*formatReport' "$FILE"; then
  echo "formatReport export not found" >&2
  exit 1
fi

# 5. formatReport should call renderHtml.
if ! grep -q 'renderHtml(' "$FILE"; then
  echo "formatReport does not call renderHtml" >&2
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
