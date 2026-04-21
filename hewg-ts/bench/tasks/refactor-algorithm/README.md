# Refactor `parseCSV` to use a state machine

The workspace contains a small TypeScript project with `src/csv.ts` that exports
a `parseCSV` function. The current implementation uses ad-hoc string splitting
with manual index tracking — it works but is fragile and hard to follow.

Your task: **Refactor the implementation to use an explicit state machine** with
named states (e.g., `FieldStart`, `InUnquotedField`, `InQuotedField`,
`AfterQuote`). The behavior must remain identical.

Requirements:
1. The function signature must remain: `parseCSV(input: string): Row[]`
2. Replace the current ad-hoc control flow with an explicit state machine
   pattern using a `state` variable and named states (enum, string union, or
   similar).
3. The function must still correctly handle:
   - Simple comma-separated values
   - Quoted fields (e.g., `"hello,world"` is one field)
   - Escaped quotes (e.g., `"say ""hi"""` → `say "hi"`)
   - Empty fields (e.g., `a,,b` → `["a","","b"]`)
   - Newlines inside quoted fields
4. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
