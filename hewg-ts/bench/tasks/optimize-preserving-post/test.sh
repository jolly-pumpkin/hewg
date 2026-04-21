#!/usr/bin/env bash
# Ground-truth check for optimize-preserving-post.
# Exit 0 iff the task is complete.
set -u

FILE="src/collections.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must still export sortAndDeduplicate.
if ! grep -q 'export function sortAndDeduplicate' "$FILE"; then
  echo "sortAndDeduplicate export not found" >&2
  exit 1
fi

# 2. Must NOT use the old two-pass pattern (copying + .sort() then .filter() on the sorted result).
# Check specifically for the pattern: [...input].sort(...) followed by sorted.filter(...)
if grep -qE '\[\.\.\.input\]\.sort\(' "$FILE" && grep -qE '\.filter\(\s*\(val.*idx\)' "$FILE"; then
  echo "still using the original two-pass [...input].sort() + .filter() approach" >&2
  exit 1
fi

# 3. Behavioral tests via bun eval.
if command -v bun >/dev/null 2>&1; then
  RESULT=$(bun -e "
    const { sortAndDeduplicate } = await import('./src/collections.ts');
    const tests = [
      { input: [3,1,2,1,3], expected: [1,2,3] },
      { input: [], expected: [] },
      { input: [5], expected: [5] },
      { input: [1,1,1,1], expected: [1] },
      { input: [10,5,3,8,5,10,1], expected: [1,3,5,8,10] },
    ];
    let ok = true;
    for (const t of tests) {
      const result = sortAndDeduplicate(t.input);
      if (JSON.stringify(result) !== JSON.stringify(t.expected)) {
        console.error('FAIL: input=' + JSON.stringify(t.input) + ' expected=' + JSON.stringify(t.expected) + ' got=' + JSON.stringify(result));
        ok = false;
      }
    }
    if (ok) console.log('BEHAVIORAL_PASS');
    else process.exit(1);
  " 2>&1)
  if [ $? -ne 0 ]; then
    echo "behavioral test failed: $RESULT" >&2
    exit 1
  fi
  if ! echo "$RESULT" | grep -q 'BEHAVIORAL_PASS'; then
    echo "behavioral test did not pass: $RESULT" >&2
    exit 1
  fi
fi

# 4. Type-check passes.
if command -v tsc >/dev/null 2>&1; then
  if ! tsc --noEmit 2>/dev/null; then
    echo "tsc --noEmit failed" >&2
    exit 1
  fi
fi

exit 0
