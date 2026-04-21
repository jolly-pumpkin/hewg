# Convert `loadConfig` to async and propagate through all callers

The workspace contains a small TypeScript project where `src/config.ts` exports
a synchronous `loadConfig` function that uses `readFileSync`. Three other files
call `loadConfig`: `src/server.ts`, `src/cli.ts`, and `src/migrate.ts`.

Your task: **Convert `loadConfig` to async** (using `fs.promises.readFile`
instead of `readFileSync`) and **propagate `async/await`** through every caller.

Requirements:
1. Change `loadConfig` in `src/config.ts` to be `async` and use
   `fs.promises.readFile` (or the `readFile` from `node:fs/promises`) instead of
   `readFileSync`.
2. Update the return type to `Promise<AppConfig>`.
3. Make every function that calls `loadConfig` async and `await` the call.
4. Update the return types of callers to `Promise<...>` as appropriate.
5. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
