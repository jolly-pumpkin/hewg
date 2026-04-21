# Make `syncPrices` testable by injecting an HTTP client

The workspace contains a small TypeScript project with `src/prices.ts` that
exports a `syncPrices` function. Currently it hardcodes `fetch()` to call
`https://api.prices.example.com`.

Your task: **Make `syncPrices` testable** by accepting an HTTP client as a
parameter instead of calling `fetch` directly.

Requirements:
1. Define an `HttpClient` type (interface or type alias) that represents the
   minimal HTTP interface needed (a function that takes a URL string and returns
   a `Promise` with a JSON-compatible response). Export it from `src/types.ts`.
2. Add an `http` parameter of type `HttpClient` to `syncPrices`.
3. Remove the direct `fetch` call — use the `http` parameter instead.
4. The function must still return `Promise<Price[]>` and still update the cache.
5. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
