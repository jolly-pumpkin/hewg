#!/usr/bin/env bash
set -euo pipefail

FAIL=0

# 1. html.ts exists
if [ ! -f src/output/html.ts ]; then
  echo "FAIL: src/output/html.ts does not exist"
  FAIL=1
fi

# 2. writeHtml exported
if [ -f src/output/html.ts ]; then
  if ! grep -q 'export function writeHtml' src/output/html.ts; then
    echo "FAIL: writeHtml not exported from src/output/html.ts"
    FAIL=1
  fi

  # 3. Contains HTML table markup
  if ! grep -q '<table>' src/output/html.ts; then
    echo "FAIL: src/output/html.ts does not contain <table> markup"
    FAIL=1
  fi

  # 4. Uses Bun.write for file output
  if ! grep -q 'Bun.write' src/output/html.ts; then
    echo "FAIL: src/output/html.ts does not use Bun.write"
    FAIL=1
  fi
fi

# 5. ReportFormat includes "html"
if ! grep -qE '"html"' src/types.ts; then
  echo "FAIL: 'html' not found in ReportFormat in src/types.ts"
  FAIL=1
fi

# 6. report.ts handles html format
if ! grep -qE "(case ['\"]html['\"]|format.*html|html.*import)" src/commands/report.ts; then
  echo "FAIL: src/commands/report.ts does not handle html format"
  FAIL=1
fi

# 7. report.ts imports from html module
if ! grep -qE "(from ['\"].*output/html|import.*html)" src/commands/report.ts; then
  echo "FAIL: src/commands/report.ts does not import from html output module"
  FAIL=1
fi

# 8. TypeScript check
if command -v tsc &>/dev/null; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "FAIL: tsc --noEmit failed"
    FAIL=1
  fi
fi

exit $FAIL
