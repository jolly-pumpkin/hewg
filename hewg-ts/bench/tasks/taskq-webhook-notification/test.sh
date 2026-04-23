#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. dead-letter.ts imports from notifications
if ! grep -qE "import.*from.*(../notifications|../notifications/router)" src/queue/dead-letter.ts; then
  echo "FAIL: notifications import not found in src/queue/dead-letter.ts"
  FAIL=1
fi

# 2. dead-letter.ts calls notifyJobFailed or references NotificationRouter
if ! grep -qE '(notifyJobFailed|NotificationRouter)' src/queue/dead-letter.ts; then
  echo "FAIL: notifyJobFailed/NotificationRouter not found in src/queue/dead-letter.ts"
  FAIL=1
fi

# 3. manager.ts references NotificationRouter
if ! grep -q 'NotificationRouter' src/queue/manager.ts; then
  echo "FAIL: NotificationRouter not found in src/queue/manager.ts"
  FAIL=1
fi

# 4. notifications/router.ts still exports NotificationRouter
if ! grep -q 'export.*NotificationRouter' src/notifications/router.ts; then
  echo "FAIL: NotificationRouter export missing or altered in src/notifications/router.ts"
  FAIL=1
fi

# 5. transforms/ files are unchanged — check key exports still present
if ! grep -q 'export' src/transforms/priority.ts; then
  echo "FAIL: src/transforms/priority.ts exports missing or altered"
  FAIL=1
fi

if ! grep -q 'export' src/transforms/payload.ts; then
  echo "FAIL: src/transforms/payload.ts exports missing or altered"
  FAIL=1
fi

# 6. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
