# TaskQ — Multi-Tenant Task Queue Service

## Architecture Overview

TaskQ is a multi-tenant job queue service. Tenants submit jobs via an HTTP API, jobs are dispatched to typed workers, and usage is tracked for billing.

**Request flow:** API handler -> authentication -> queue scheduler -> dispatcher -> worker pool -> worker -> notifications

## Directory Structure

### Pure modules (no IO — safe to refactor freely)

- `src/types/` — Shared type definitions: Job, Tenant, WorkerConfig, BillingPlan, etc.
- `src/transforms/` — Data validation, serialization, priority calculation, retry logic, formatting. All functions are pure computations with no side effects.
- `src/auth/token.ts` — JWT token parsing and expiry checking (string manipulation only).
- `src/auth/tenant-isolation.ts` — Tenant access checks (throws on mismatch, no IO).
- `src/auth/middleware.ts` — Auth result construction, scope validation (pure helpers).
- `src/queue/priority-queue.ts` — Generic sorted priority queue data structure.
- `src/queue/retry-policy.ts` — Retry policy configuration and application logic.
- `src/queue/concurrency-limiter.ts` — In-memory concurrency slot tracker.
- `src/workers/registry.ts` — Worker factory registration (pure map).
- `src/billing/plan-calculator.ts` — Billing cost computation, quota checking, invoice math.
- `src/notifications/template-renderer.ts` — Email and webhook payload templating.

### Network IO modules

- `src/auth/jwks.ts` — Fetches JWKS key sets from a remote URL for JWT verification.
- `src/workers/http-worker.ts` — Executes HTTP request jobs (fetch to external URLs).
- `src/workers/webhook-worker.ts` — Sends webhook POST requests to configured endpoints.
- `src/workers/email-worker.ts` — Sends email via SMTP (TCP connections).
- `src/notifications/email-sender.ts` — Low-level SMTP email dispatch.
- `src/notifications/webhook-dispatcher.ts` — Low-level webhook HTTP POST.
- `src/notifications/router.ts` — Routes notifications to email and webhook channels.
- `src/api/router.ts` — Top-level HTTP router, handles auth and delegates to handlers.

### Filesystem IO modules (database layer)

- `src/storage/connection.ts` — Database connection (JSON file backed).
- `src/storage/jobs.ts` — Job CRUD operations (read/write to database).
- `src/storage/tenants.ts` — Tenant CRUD operations.
- `src/storage/billing.ts` — Usage record tracking and updates.
- `src/storage/migrations.ts` — Database schema initialization.
- `src/storage/queries.ts` — Read-only database queries.
- `src/queue/scheduler.ts` — Job scheduling (validates and writes to database).
- `src/queue/dead-letter.ts` — Dead letter queue management (writes to database).
- `src/billing/usage-tracker.ts` — Tracks job submission/completion/failure in database.
- `src/billing/invoice-generator.ts` — Generates and stores invoices.

### Mixed IO modules

- `src/config/env.ts` — Reads environment variables.
- `src/config/loader.ts` — Reads config file and environment.
- `src/queue/dispatch.ts` — Dispatches jobs from queue (database reads/writes + logging).
- `src/queue/manager.ts` — Main queue orchestrator (database + logging).
- `src/queue/rate-limiter.ts` — Token bucket rate limiter (reads system clock).
- `src/workers/base.ts` — Base worker with logging.
- `src/workers/transform-worker.ts` — Transform worker (logging only, no network/fs).
- `src/workers/pool.ts` — Worker pool management (logging + timing).
- `src/workers/health.ts` — Worker health checks (reads clock + logging).
- `src/billing/rate-limit-checker.ts` — Checks rate limits (database read + clock).
- `src/api/jobs.ts` — Job API handlers (database + logging).
- `src/api/tenants.ts` — Tenant API handlers (database + logging).
- `src/api/billing.ts` — Billing API handlers (database + logging).
- `src/api/health.ts` — Health check endpoint (database read + clock + logging).

## Dependency Direction

```
API layer (src/api/)
  -> Auth (src/auth/)
  -> Queue (src/queue/)
    -> Storage (src/storage/)
    -> Transforms (src/transforms/)
  -> Workers (src/workers/)
    -> Notifications (src/notifications/)
  -> Billing (src/billing/)
    -> Storage (src/storage/)
```

Types (`src/types/`) are imported by all layers. Config (`src/config/`) is imported at the API/entrypoint level.

## Key Patterns

- **Tenant isolation**: All API handlers receive a `TenantContext` and call `assertTenantAccess` before accessing resources. Jobs and billing records are scoped to tenants.
- **Worker dispatch**: The queue manager dispatches pending jobs to workers via the worker pool. Workers are typed (HTTP, email, webhook, transform) and registered via a factory registry.
- **Billing**: Usage is tracked per-tenant per-period. Rate limits are enforced before job submission. Invoices are generated from usage records and billing plans.
- **Notifications**: Job completion and failure trigger notifications routed through email and webhook channels.
