#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. A validation function for HTTP payloads exists in src/transforms/
if ! grep -rq 'validateHttpJobPayload\|validateHttpPayload\|validateUrlPayload' src/transforms/; then
  echo "FAIL: no HTTP payload validation function found in src/transforms/"
  FAIL=1
fi

# 2. A validation function for email payloads exists in src/transforms/
if ! grep -rq 'validateEmailJobPayload\|validateEmailPayload\|validateEmail' src/transforms/; then
  echo "FAIL: no email payload validation function found in src/transforms/"
  FAIL=1
fi

# 3. Workers import from ../transforms/
if ! grep -q "from.*['\"]\.\.\/transforms\/" src/workers/http-worker.ts; then
  echo "FAIL: src/workers/http-worker.ts does not import from ../transforms/"
  FAIL=1
fi

if ! grep -q "from.*['\"]\.\.\/transforms\/" src/workers/email-worker.ts; then
  echo "FAIL: src/workers/email-worker.ts does not import from ../transforms/"
  FAIL=1
fi

if ! grep -q "from.*['\"]\.\.\/transforms\/" src/workers/webhook-worker.ts; then
  echo "FAIL: src/workers/webhook-worker.ts does not import from ../transforms/"
  FAIL=1
fi

if ! grep -q "from.*['\"]\.\.\/transforms\/" src/workers/transform-worker.ts; then
  echo "FAIL: src/workers/transform-worker.ts does not import from ../transforms/"
  FAIL=1
fi

# 4. Workers don't contain inline URL/email validation patterns
if grep -qE 'url\.startsWith\(|new RegExp.*@.*\.\|/^https?:\/\//|\.match\(.*@.*\)' src/workers/http-worker.ts; then
  echo "FAIL: src/workers/http-worker.ts still contains inline validation patterns"
  FAIL=1
fi

if grep -qE 'email\.includes\(.*@|new RegExp.*@.*\.\|\.match\(.*@.*\)' src/workers/email-worker.ts; then
  echo "FAIL: src/workers/email-worker.ts still contains inline email validation patterns"
  FAIL=1
fi

# 5. TypeScript check (if tsc available)
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

# 6. No new exports added to storage, api, or queue modules
for dir in src/storage src/api src/queue; do
  if [ -d "$dir" ]; then
    if git diff --name-only -- "$dir" 2>/dev/null | grep -q .; then
      echo "FAIL: files in $dir were modified"
      FAIL=1
    fi
  fi
done

exit $FAIL
