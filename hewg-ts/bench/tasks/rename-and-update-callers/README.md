# Rename `getUser` to `findUserById` and update all callers

The workspace contains a small TypeScript project where `src/user.ts` exports a
function called `getUser`. This function is imported and called in four other
files: `src/auth.ts`, `src/admin.ts`, `src/api.ts`, and `src/middleware.ts`.

Your task: **Rename `getUser` to `findUserById`** and update every import and
call site across the entire codebase.

Requirements:
1. Rename the function definition in `src/user.ts` from `getUser` to `findUserById`.
2. Update the export so the new name is exported.
3. Update every `import { getUser }` to `import { findUserById }` in all files.
4. Update every call from `getUser(...)` to `findUserById(...)` in all files.
5. The name `getUser` should not appear anywhere in the codebase as a function
   name, import, or call (it may remain in comments).
6. The code must compile without type errors.

Run `run_tests` to verify. Exit code 0 means the task is complete; reply with
`DONE` once tests pass.
