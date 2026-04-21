# Optimize `sortAndDeduplicate` while preserving postconditions

The workspace contains a small TypeScript project with `src/collections.ts` that
exports a `sortAndDeduplicate` function. The current implementation uses two
passes: first `.sort()`, then `.filter()` to remove duplicates.

Your task: **Optimize the implementation** to avoid the separate filter pass.
Use a single-pass approach that builds the result directly (e.g., using a
`Set` or by inserting into a sorted structure).

Requirements:
1. The function must still be named `sortAndDeduplicate` with the same signature:
   `sortAndDeduplicate(input: number[]): number[]`
2. The function must still return a **new** sorted array with no duplicates.
3. The optimization must eliminate the separate `.sort()` + `.filter()` two-pass
   approach. The result should be built in a more integrated way.
4. **Postconditions that must hold** (these are the contract):
   - `result.length <= input.length`
   - The result is sorted in ascending order
   - The result has no duplicate values
5. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
