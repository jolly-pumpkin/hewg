# Task: Thread TenantContext Through Request Path

## Context

This is a multi-tenant task queue service. Currently `TenantContext` is only used in the API layer (`src/api/`), but the queue and worker layers don't receive it. We need it threaded through for tenant-scoped logging and billing.

## Task

Thread `TenantContext` (from `src/types/tenant.ts`) through the request path so workers can access tenant information.

1. Add a `tenantContext` parameter to `QueueManager.submitJob()` in `src/queue/manager.ts` and pass it through to `scheduleJob()` in `src/queue/scheduler.ts`.
2. Add `tenantId` field to the `Job` interface in `src/types/job.ts` (it already exists — verify it's being set from the context).
3. Add a `tenantContext?: TenantContext` parameter to `WorkerPool.assignJob()` in `src/workers/pool.ts`.
4. Update the API handlers in `src/api/jobs.ts` to pass `TenantContext` through the submit path.
5. Do NOT modify `src/transforms/` or `src/types/billing.ts` — these are pure modules that don't need tenant context.

## Verification

Run `bash test.sh`
