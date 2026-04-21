#!/usr/bin/env bash
# build-conditions.sh — Generate conditions 1 and 2 from the gold-standard condition 3-4.
#
# Usage:
#   ./bench/scripts/build-conditions.sh <task-dir>
#   ./bench/scripts/build-conditions.sh bench/tasks/add-retry-no-new-effects
#
# Reads:  <task-dir>/conditions/3-4/
# Writes: <task-dir>/conditions/1/   (plain TS — all JSDoc stripped)
#         <task-dir>/conditions/2/   (TS + standard JSDoc — Hewg tags stripped)
#
# Idempotent: re-running overwrites conditions 1 and 2.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <task-dir>" >&2
  exit 1
fi

TASK_DIR="$1"
GOLD="${TASK_DIR}/conditions/3-4"

if [ ! -d "$GOLD" ]; then
  echo "error: ${GOLD} does not exist" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Condition 1: Plain TypeScript — strip ALL JSDoc blocks and hewg.config.json
# ---------------------------------------------------------------------------
COND1="${TASK_DIR}/conditions/1"
rm -rf "$COND1"
cp -R "$GOLD" "$COND1"
rm -f "${COND1}/hewg.config.json"

# Strip all /** ... */ JSDoc blocks from .ts files (multiline).
# Uses awk to handle multiline blocks correctly, including single-line /** ... */
find "$COND1" -name '*.ts' -print0 | while IFS= read -r -d '' file; do
  awk '
    /^[[:space:]]*\/\*\*.*\*\// { next }
    /^[[:space:]]*\/\*\*/ { in_jsdoc=1; next }
    in_jsdoc && /\*\// { in_jsdoc=0; next }
    in_jsdoc { next }
    { print }
  ' "$file" > "${file}.tmp"
  mv "${file}.tmp" "$file"
done

# Remove blank lines that were left behind where JSDoc blocks were (collapse
# runs of 3+ blank lines down to 1).
find "$COND1" -name '*.ts' -print0 | while IFS= read -r -d '' file; do
  awk '
    /^[[:space:]]*$/ { blank++; next }
    { if (blank > 0) print ""; blank=0; print }
    END { if (blank > 0) print "" }
  ' "$file" > "${file}.tmp"
  mv "${file}.tmp" "$file"
done

# ---------------------------------------------------------------------------
# Condition 2: TS + standard JSDoc — strip Hewg-specific tags only
# ---------------------------------------------------------------------------
COND2="${TASK_DIR}/conditions/2"
rm -rf "$COND2"
cp -R "$GOLD" "$COND2"
rm -f "${COND2}/hewg.config.json"

# Inside JSDoc blocks, remove lines containing Hewg-specific tags.
# Keep @param, @returns, @throws, @template, @typedef, @type, @example, description lines.
# If a JSDoc block ends up empty (only /** and */ remain), remove the whole block.
find "$COND2" -name '*.ts' -print0 | while IFS= read -r -d '' file; do
  awk '
    /^[[:space:]]*\/\*\*/ {
      # Start collecting a JSDoc block
      in_jsdoc = 1
      block_start = NR
      delete block
      block_len = 0
      block[++block_len] = $0
      next
    }
    in_jsdoc {
      # Check for Hewg-specific tags — skip these lines
      if ($0 ~ /@hewg-module/ || $0 ~ /@effects/ || $0 ~ /@cap[[:space:]]/ || $0 ~ /@pre[[:space:]]/ || $0 ~ /@post[[:space:]]/ || $0 ~ /@cost[[:space:]]/) {
        next
      }
      block[++block_len] = $0
      if ($0 ~ /\*\//) {
        in_jsdoc = 0
        # Check if block has content beyond /** and */
        has_content = 0
        for (i = 1; i <= block_len; i++) {
          line = block[i]
          # Skip the opening /** line
          if (line ~ /^[[:space:]]*\/\*\*[[:space:]]*$/) continue
          # Skip the closing */ line
          if (line ~ /^[[:space:]]*\*\/[[:space:]]*$/) continue
          # Skip empty doc lines (just " * ")
          if (line ~ /^[[:space:]]*\*[[:space:]]*$/) continue
          # Anything else is content
          has_content = 1
          break
        }
        if (has_content) {
          for (i = 1; i <= block_len; i++) {
            print block[i]
          }
        }
        # else: empty block, discard it
      }
      next
    }
    { print }
  ' "$file" > "${file}.tmp"
  mv "${file}.tmp" "$file"
done

# Collapse runs of 3+ blank lines.
find "$COND2" -name '*.ts' -print0 | while IFS= read -r -d '' file; do
  awk '
    /^[[:space:]]*$/ { blank++; next }
    { if (blank > 0) print ""; blank=0; print }
    END { if (blank > 0) print "" }
  ' "$file" > "${file}.tmp"
  mv "${file}.tmp" "$file"
done

echo "built conditions/1 and conditions/2 for ${TASK_DIR}"
