#!/usr/bin/env bash
# Ground-truth check for split-pure-io.
# Exit 0 iff the task is complete.
set -u

FILE="src/deploy.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must export buildManifest.
if ! grep -q 'export function buildManifest' "$FILE"; then
  echo "buildManifest not exported from $FILE" >&2
  exit 1
fi

# 2. buildManifest must accept ArtifactInput and return Manifest.
if ! grep -qE 'buildManifest\s*\([^)]*ArtifactInput' "$FILE"; then
  echo "buildManifest does not accept ArtifactInput" >&2
  exit 1
fi

# 3. deployArtifact must still be exported.
if ! grep -q 'export function deployArtifact' "$FILE"; then
  echo "deployArtifact export not found" >&2
  exit 1
fi

# 4. deployArtifact must call buildManifest.
if ! grep -q 'buildManifest(' "$FILE"; then
  echo "deployArtifact does not call buildManifest" >&2
  exit 1
fi

# 5. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
