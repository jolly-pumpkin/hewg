# Task: Add Structured Audit Logging to Database Writes

## Context

This is a multi-tenant task queue service. We need audit logging on all database write operations for compliance.

## Task

Add structured audit logging to every function in `src/storage/` that writes to the database.

1. Create `src/storage/audit.ts` with an `auditLog(entry: AuditEntry): void` function that writes structured JSON to console.log. AuditEntry should include: operation (string), table (string), recordId (string), tenantId (string | null), timestamp (ISO string), details (unknown).
2. Add audit logging calls to every write operation in `src/storage/jobs.ts`, `src/storage/tenants.ts`, `src/storage/billing.ts`, and `src/storage/migrations.ts`.
3. The `auditLog` function itself should only use `console.log` — no file writes, no network calls.
4. Do NOT modify `src/transforms/`, `src/types/`, `src/auth/`, or `src/queue/priority-queue.ts`. These are pure modules.
5. Do NOT change function signatures in the storage module.

## Verification

Run `bash test.sh`
