#!/usr/bin/env bash
# Ground-truth check for the smoke task. Exit 0 iff the task is complete.
set -u
if [ ! -f src/greet.ts ]; then
  echo "missing src/greet.ts" >&2
  exit 1
fi
if ! grep -q "Greets the named user." src/greet.ts; then
  echo "src/greet.ts does not contain 'Greets the named user.'" >&2
  exit 1
fi
exit 0
