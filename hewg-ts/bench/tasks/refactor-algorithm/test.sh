#!/usr/bin/env bash
# Ground-truth check for refactor-algorithm.
# Exit 0 iff the task is complete.
set -u

FILE="src/csv.ts"

if [ ! -f "$FILE" ]; then
  echo "missing $FILE" >&2
  exit 1
fi

# 1. Must still export parseCSV.
if ! grep -q 'export function parseCSV' "$FILE"; then
  echo "parseCSV export not found" >&2
  exit 1
fi

# 2. Must use a state machine pattern (check for state variable with named states).
# Accept any of: a `state` variable, a State type/enum, or string literal states.
if ! grep -qE '(state\s*[=:]|State\s*[=\{|:]|type\s+State|enum\s+State|"[A-Z][a-zA-Z]+".*"[A-Z][a-zA-Z]+")' "$FILE"; then
  echo "no state machine pattern detected (expected state variable or named states)" >&2
  exit 1
fi

# 3. Behavioral tests via bun eval.
if command -v bun >/dev/null 2>&1; then
  RESULT=$(bun -e "
    const { parseCSV } = await import('./src/csv.ts');
    const tests = [
      { input: 'a,b,c\n1,2,3', expected: [['a','b','c'],['1','2','3']] },
      { input: '\"hello,world\",plain', expected: [['hello,world','plain']] },
      { input: '\"say \"\"hi\"\"\"', expected: [['say \"hi\"']] },
      { input: 'a,,b', expected: [['a','','b']] },
      { input: '\"line1\nline2\",end', expected: [['line1\nline2','end']] },
    ];
    let ok = true;
    for (const t of tests) {
      const result = parseCSV(t.input);
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
