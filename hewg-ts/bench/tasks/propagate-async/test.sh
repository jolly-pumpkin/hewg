#!/usr/bin/env bash
# Ground-truth check for propagate-async.
# Exit 0 iff the task is complete.
set -u

CONFIG="src/config.ts"
SERVER="src/server.ts"
CLI="src/cli.ts"
MIGRATE="src/migrate.ts"

for f in "$CONFIG" "$SERVER" "$CLI" "$MIGRATE"; do
  if [ ! -f "$f" ]; then
    echo "missing $f" >&2
    exit 1
  fi
done

# 1. loadConfig must be async.
if ! grep -qE 'export\s+async\s+function\s+loadConfig|async\s+function\s+loadConfig' "$CONFIG"; then
  echo "loadConfig is not async in $CONFIG" >&2
  exit 1
fi

# 2. Must NOT use readFileSync.
if grep -q 'readFileSync' "$CONFIG"; then
  echo "readFileSync still used in $CONFIG" >&2
  exit 1
fi

# 3. Must use readFile from fs/promises or fs.promises.
if ! grep -qE '(readFile|fs\.promises)' "$CONFIG"; then
  echo "async readFile not found in $CONFIG" >&2
  exit 1
fi

# 4. Each caller must be async.
if ! grep -qE 'async\s+function\s+initServer' "$SERVER"; then
  echo "initServer is not async in $SERVER" >&2
  exit 1
fi
if ! grep -qE 'async\s+function\s+showStatus' "$CLI"; then
  echo "showStatus is not async in $CLI" >&2
  exit 1
fi
if ! grep -qE 'async\s+function\s+runMigrations' "$MIGRATE"; then
  echo "runMigrations is not async in $MIGRATE" >&2
  exit 1
fi

# 5. Each caller must await loadConfig.
for f in "$SERVER" "$CLI" "$MIGRATE"; do
  if ! grep -q 'await loadConfig\|await.*loadConfig' "$f"; then
    echo "loadConfig not awaited in $f" >&2
    exit 1
  fi
done

# 6. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
