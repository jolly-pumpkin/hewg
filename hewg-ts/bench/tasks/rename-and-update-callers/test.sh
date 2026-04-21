#!/usr/bin/env bash
# Ground-truth check for rename-and-update-callers.
# Exit 0 iff the task is complete.
set -u

USER_FILE="src/user.ts"
CALLERS="src/auth.ts src/admin.ts src/api.ts src/middleware.ts"

if [ ! -f "$USER_FILE" ]; then
  echo "missing $USER_FILE" >&2
  exit 1
fi

# 1. findUserById must be exported from user.ts.
if ! grep -q 'export function findUserById' "$USER_FILE"; then
  echo "findUserById not exported from $USER_FILE" >&2
  exit 1
fi

# 2. getUser must NOT appear as a function definition or export in user.ts.
if grep -qE '(export function getUser|function getUser)' "$USER_FILE"; then
  echo "getUser still defined in $USER_FILE" >&2
  exit 1
fi

# 3. Each caller must import findUserById (not getUser).
for f in $CALLERS; do
  if [ ! -f "$f" ]; then
    echo "missing $f" >&2
    exit 1
  fi
  if ! grep -q 'findUserById' "$f"; then
    echo "findUserById not found in $f" >&2
    exit 1
  fi
  # getUser should not appear as an import or call (allow in comments)
  if grep -qE '(import.*getUser|(^|[^a-zA-Z/])getUser\s*\()' "$f"; then
    echo "getUser still referenced in $f" >&2
    exit 1
  fi
done

# 4. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
