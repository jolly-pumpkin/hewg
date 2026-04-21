# Add retry logic to `fetchUser` without introducing new side effects

The workspace contains a small TypeScript project with an `src/api.ts` file that
exports an async `fetchUser` function. This function makes an HTTPS request and
throws `ApiError` on failure.

Your task: **add retry logic to `fetchUser`** so that it retries the request up
to 3 times when a network error occurs (i.e., when `fetch` itself throws — not
when the server returns an error status). After 3 failed attempts, re-throw the
original error.

Constraints:
- Do **not** introduce any side effects beyond what the function already
  performs. No logging, no sleeping/delays, no file writes, no timers.
- Do **not** import or call any functions from `src/util.ts`.
- The function signature must remain the same: `fetchUser(id: string): Promise<User>`.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
