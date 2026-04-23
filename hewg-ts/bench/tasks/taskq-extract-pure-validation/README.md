# Task: Extract Pure Validation Logic from Workers

## Context

This is a multi-tenant task queue service. Several worker files contain inline validation logic that duplicates what's in `src/transforms/`.

## Task

Extract all inline payload validation from worker files into `src/transforms/` and have workers import from there.

1. Look at `src/workers/http-worker.ts`, `src/workers/email-worker.ts`, `src/workers/webhook-worker.ts`, and `src/workers/transform-worker.ts`. Each has inline validation of job payload fields.
2. Create appropriate validation functions in `src/transforms/` (either add to `validate-job.ts` or create a new `validate-payload.ts`). These must be pure functions — no IO.
3. Update the worker files to import and use the extracted validation functions instead of inline checks.
4. Do NOT change the behavior or signatures of any worker functions — only refactor the validation logic.
5. Do NOT modify `src/storage/`, `src/api/`, or `src/queue/` files.

## Verification

Run `bash test.sh`
