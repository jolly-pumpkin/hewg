#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. audit.ts exists and exports auditLog
if [ ! -f src/storage/audit.ts ]; then
  echo "FAIL: src/storage/audit.ts does not exist"
  FAIL=1
fi

if ! grep -q 'export.*auditLog\|export.*function auditLog' src/storage/audit.ts; then
  echo "FAIL: auditLog not exported from src/storage/audit.ts"
  FAIL=1
fi

# 2. jobs.ts imports from ./audit
if ! grep -q "from.*['\"]\.\/audit['\"]" src/storage/jobs.ts; then
  echo "FAIL: src/storage/jobs.ts does not import from ./audit"
  FAIL=1
fi

# 3. tenants.ts imports from ./audit
if ! grep -q "from.*['\"]\.\/audit['\"]" src/storage/tenants.ts; then
  echo "FAIL: src/storage/tenants.ts does not import from ./audit"
  FAIL=1
fi

# 4. billing.ts imports from ./audit
if ! grep -q "from.*['\"]\.\/audit['\"]" src/storage/billing.ts; then
  echo "FAIL: src/storage/billing.ts does not import from ./audit"
  FAIL=1
fi

# 5. audit.ts uses console.log
if ! grep -q 'console\.log' src/storage/audit.ts; then
  echo "FAIL: src/storage/audit.ts does not use console.log"
  FAIL=1
fi

# 6. audit.ts does NOT use writeFileSync or fetch
if grep -q 'writeFileSync' src/storage/audit.ts; then
  echo "FAIL: src/storage/audit.ts uses writeFileSync (should only use console.log)"
  FAIL=1
fi

if grep -q 'fetch(' src/storage/audit.ts; then
  echo "FAIL: src/storage/audit.ts uses fetch (should only use console.log)"
  FAIL=1
fi

# 7. src/transforms/ files are unchanged — check key exports still present
for f in src/transforms/*.ts; do
  if [ -f "$f" ]; then
    if ! grep -q 'export' "$f"; then
      echo "FAIL: exports missing or altered in $f"
      FAIL=1
    fi
  fi
done

# 8. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
