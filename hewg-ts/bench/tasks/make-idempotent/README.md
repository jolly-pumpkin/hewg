# Make `processOrder` idempotent

The workspace contains a small TypeScript project with `src/orders.ts` that
exports a `processOrder` function. Currently, calling it twice with the same
order processes it twice (saving a duplicate receipt and sending a duplicate
notification).

Your task: **Make `processOrder` idempotent** — if called with an order whose
receipt already exists on disk, it should return the existing receipt without
saving again or notifying again.

Requirements:
1. Before processing, check if a receipt already exists using the helpers in
   `src/db.ts`. If it exists, return the existing receipt immediately.
2. Do **not** introduce any new side effects beyond what the function already
   declares (no logging, no new file writes, no timers).
3. The function signature must remain `processOrder(order: Order): Promise<Receipt>`.
4. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
