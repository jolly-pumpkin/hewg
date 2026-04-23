<!-- hewg:start -->
# Hewg Annotation Guide

This project uses Hewg annotations in JSDoc comments to declare function contracts.

## Annotations

- `@effects <list>` — Declares what side effects a function performs. An empty `@effects` (no list) means the function is **pure** — no IO, no side effects. Common effects:
  - `net.https` / `net.http` — makes HTTP requests
  - `fs.read` — reads from the filesystem
  - `fs.write` — writes to the filesystem
  - `log` — writes to console/stdout
  - `proc.exec` / `proc.spawn` — runs child processes
  - `rand` — uses random number generation
  - `time.read` / `time.sleep` — reads clock or sleeps
- `@hewg-module <path>` — Declares which module a file belongs to.
- `@cap <name> <effect>` — Declares a capability parameter the function requires.
- `@pre <condition>` — Precondition that must hold when calling the function.
- `@post <condition>` — Postcondition guaranteed after the function returns.
- `@idempotent` — Function is safe to call multiple times with the same arguments.
- `@layer <tier>` — Architectural tier: `api`, `service`, `command`, `output`, or `lib`.

## Rules for modifying annotated code

| You want to... | Check | Action |
|-----------------|-------|--------|
| Add IO (fetch, console.log, fs) to a function | Does `@effects` have no listed effects? | **STOP.** The function is pure. Add the IO in a caller that already declares the relevant effect. |
| Add IO to a function | Does `@effects` already list the needed effect? | Proceed — the function already performs this kind of IO. |
| Add IO to a function | `@effects` lists other effects but not this one | Update `@effects` to include the new effect, or move the IO to a different function. |
| Call a new function from an existing one | Does the callee have effects the caller lacks? | **STOP.** You would introduce an undeclared effect. Move the call to an appropriate site. |
| Create a new function | — | Add `@effects` listing every IO it performs. If none, use empty `@effects`. |
| Modify a function with `@pre`/`@post` | — | Ensure your changes preserve the preconditions and postconditions. |

## Architecture (by effect boundary)

**Pure (no effects):**
- `src/auth/middleware.ts`
- `src/auth/tenant-isolation.ts`
- `src/billing/plan-calculator.ts`
- `src/config/env.ts`
- `src/notifications/email-sender.ts`
- `src/notifications/template-renderer.ts`
- `src/queue/concurrency-limiter.ts`
- `src/queue/priority-queue.ts`
- `src/queue/retry-policy.ts`
- `src/transforms/priority.ts`
- `src/transforms/retry.ts`
- `src/transforms/serialize.ts`
- `src/transforms/validate-job.ts`
- `src/transforms/validate-tenant.ts`
- `src/types/billing.ts`
- `src/types/job.ts`
- `src/types/tenant.ts`
- `src/types/worker.ts`
- `src/workers/registry.ts`

**fs.read, log:**
- `src/api/billing.ts`

**fs.read, log, time.read:**
- `src/api/health.ts`

**fs.read, fs.write, log, time.read:**
- `src/api/jobs.ts`
- `src/queue/manager.ts`

**fs.read, fs.write, log, net.https, time.read:**
- `src/api/router.ts`

**fs.read, fs.write, log:**
- `src/api/tenants.ts`
- `src/queue/dead-letter.ts`
- `src/queue/dispatch.ts`
- `src/storage/migrations.ts`

**net.https:**
- `src/auth/jwks.ts`
- `src/notifications/webhook-dispatcher.ts`

**time.read:**
- `src/auth/token.ts`
- `src/queue/rate-limiter.ts`
- `src/transforms/format.ts`

**fs.read, fs.write:**
- `src/billing/invoice-generator.ts`
- `src/billing/usage-tracker.ts`
- `src/storage/billing.ts`
- `src/storage/connection.ts`
- `src/storage/jobs.ts`
- `src/storage/tenants.ts`

**fs.read, time.read:**
- `src/billing/rate-limit-checker.ts`

**fs.read:**
- `src/config/loader.ts`
- `src/storage/queries.ts`

**log, net.https:**
- `src/notifications/router.ts`

**fs.read, fs.write, time.read:**
- `src/queue/scheduler.ts`

**log:**
- `src/workers/base.ts`

**log, time.read:**
- `src/workers/email-worker.ts`
- `src/workers/health.ts`
- `src/workers/transform-worker.ts`

**log, net.https, time.read:**
- `src/workers/http-worker.ts`
- `src/workers/webhook-worker.ts`

**log, time.sleep:**
- `src/workers/pool.ts`

## Effect call graph

Functions with effects and their callees:

**handleGetUsage** (`src/api/billing.ts`) `@effects fs.read, log`
  → /^\d{4}-\d{2}$/.test [pure]
  → getUsageRecord [fs.read]
  → console.log [log]

**handleGetInvoice** (`src/api/billing.ts`) `@effects fs.read, log`
  → /^\d{4}-\d{2}$/.test [pure]
  → defaultPlan [pure]
  → generateInvoice [fs.read]
  → console.log [log]

**handleListInvoices** (`src/api/billing.ts`) `@effects fs.read, log`
  → listInvoices [fs.read]
  → console.log [log]

**handleHealthCheck** (`src/api/health.ts`) `@effects time.read, log`
  → Date.now [time.read]
  → new Date().toISOString [pure]
  → console.log [log]

**handleReadiness** (`src/api/health.ts`) `@effects fs.read, log`
  → console.log [log]
  → countActiveJobs [fs.read]
  → new Date().toISOString [pure]

**handleCreateJob** (`src/api/jobs.ts`) `@effects fs.read, fs.write, log, time.read`
  → validateCreateJobInput [pure]
  → queue.submitJob [fs.read, fs.write, log, time.read]
  → console.log [log]

**handleGetJob** (`src/api/jobs.ts`) `@effects fs.read, log`
  → getJob [fs.read]
  → assertTenantAccess [pure]
  → console.log [log]

**handleListJobs** (`src/api/jobs.ts`) `@effects fs.read, log`
  → listJobsByTenant [fs.read]
  → console.log [log]

**handleCancelJob** (`src/api/jobs.ts`) `@effects fs.read, fs.write, log`
  → getJob [fs.read]
  → assertTenantAccess [pure]
  → updateJobStatus [fs.read, fs.write]
  → console.log [log]

**ApiRouter.route** (`src/api/router.ts`) `@effects fs.read, fs.write, net.https, log, time.read`
  → handleHealthCheck [time.read, log]
  → handleReadiness [fs.read, log]
  → this.authenticate [net.https, log, fs.read]
  → console.log [log]
  → handleCreateJob [fs.read, fs.write, log, time.read]
  → path.match [pure]
  → handleGetJob [fs.read, log]
  → handleListJobs [fs.read, log]
  → handleCancelJob [fs.read, fs.write, log]
  → handleGetTenant [fs.read, log]
  → path.startsWith [pure]
  → this.currentPeriod [pure]
  → handleGetUsage [fs.read, log]
  → handleGetInvoice [fs.read, log]
  → handleListInvoices [fs.read, log]

**handleGetTenant** (`src/api/tenants.ts`) `@effects fs.read, log`
  → getTenant [fs.read]
  → console.log [log]

**handleListTenants** (`src/api/tenants.ts`) `@effects fs.read, log`
  → listTenants [fs.read]
  → console.log [log]

**handleUpdateTenantStatus** (`src/api/tenants.ts`) `@effects fs.read, fs.write, log`
  → getTenant [fs.read]
  → validStatuses.includes [pure]
  → updateTenantStatus [fs.read, fs.write]
  → console.log [log]

**fetchJwks** (`src/auth/jwks.ts`) `@effects net.https`
  → fetch [net.https]
  → response.json [pure]
  → Array.isArray [pure]

**isTokenExpired** (`src/auth/token.ts`) `@effects time.read`
  → Math.floor [pure]
  → Date.now [time.read]

**generateInvoice** (`src/billing/invoice-generator.ts`) `@effects fs.read`
  → getUsageRecord [fs.read]
  → Math.max [pure]

**saveInvoice** (`src/billing/invoice-generator.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**listInvoices** (`src/billing/invoice-generator.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.entries [pure]
  → key.startsWith [pure]
  → invoices.push [pure]

**checkRateLimit** (`src/billing/rate-limit-checker.ts`) `@effects fs.read, time.read`
  → currentPeriod [pure]
  → getUsageRecord [fs.read]
  → nextPeriodStart [pure]
  → Date.now [time.read]
  → Math.max [pure]
  → Math.min [pure]

**trackJobSubmission** (`src/billing/usage-tracker.ts`) `@effects fs.read, fs.write`
  → currentPeriod [pure]
  → incrementJobCount [fs.read, fs.write]

**trackJobCompletion** (`src/billing/usage-tracker.ts`) `@effects fs.read, fs.write`
  → currentPeriod [pure]
  → incrementJobCount [fs.read, fs.write]
  → getUsageRecord [fs.read]
  → upsertUsageRecord [fs.read, fs.write]

**trackJobFailure** (`src/billing/usage-tracker.ts`) `@effects fs.read, fs.write`
  → currentPeriod [pure]
  → incrementJobCount [fs.read, fs.write]

**getCurrentUsage** (`src/billing/usage-tracker.ts`) `@effects fs.read`
  → currentPeriod [pure]
  → getUsageRecord [fs.read]

**loadConfig** (`src/config/loader.ts`) `@effects fs.read`
  → fs.readFileSync [fs.read]
  → JSON.parse [pure]
  → loadEnv [pure]

**NotificationRouter.notifyJobCompleted** (`src/notifications/router.ts`) `@effects net.https, log`
  → renderEmailTemplate [pure]
  → sendEmail [pure]
  → console.log [log]
  → renderWebhookPayload [pure]
  → dispatchWebhook [net.https]

**NotificationRouter.notifyJobFailed** (`src/notifications/router.ts`) `@effects net.https, log`
  → renderEmailTemplate [pure]
  → sendEmail [pure]
  → console.log [log]
  → renderWebhookPayload [pure]
  → dispatchWebhook [net.https]

**NotificationRouter.notifyTenantSuspended** (`src/notifications/router.ts`) `@effects net.https, log`
  → renderEmailTemplate [pure]
  → sendEmail [pure]
  → console.log [log]
  → renderWebhookPayload [pure]
  → dispatchWebhook [net.https]

**dispatchWebhook** (`src/notifications/webhook-dispatcher.ts`) `@effects net.https`
  → fetch [net.https]
  → response.text [pure]

**moveToDeadLetter** (`src/queue/dead-letter.ts`) `@effects fs.read, fs.write, log`
  → updateJobStatus [fs.read, fs.write]
  → console.log [log]

**processDeadLetterQueue** (`src/queue/dead-letter.ts`) `@effects fs.read, fs.write, log`
  → listJobsByStatus [fs.read]
  → console.log [log]
  → handler [pure]
  → updateJobStatus [fs.read, fs.write]

**dispatchNextJob** (`src/queue/dispatch.ts`) `@effects fs.read, fs.write, log`
  → limiter.isAtCapacity [pure]
  → console.log [log]
  → listJobsByStatus [fs.read]
  → pendingJobs.filter [pure]
  → queueJobs.sort [pure]
  → comparePriority [pure]
  → limiter.tryAcquire [pure]
  → updateJobStatus [fs.read, fs.write]

**dispatchBatch** (`src/queue/dispatch.ts`) `@effects fs.read, fs.write, log`
  → dispatchNextJob [fs.read, fs.write, log]
  → dispatched.push [pure]
  → console.log [log]

**QueueManager.submitJob** (`src/queue/manager.ts`) `@effects fs.read, fs.write, log, time.read`
  → this.rateLimiter.tryConsume [time.read]
  → scheduleJob [fs.read, fs.write, time.read]
  → console.log [log]

**QueueManager.processQueue** (`src/queue/manager.ts`) `@effects fs.read, fs.write, log`
  → dispatchNextJob [fs.read, fs.write, log]
  → console.log [log]

**QueueManager.getQueueStats** (`src/queue/manager.ts`) `@effects fs.read, log`
  → listJobsByStatus [fs.read]
  → jobs.filter [pure]
  → countByStatus [fs.read]
  → console.log [log]
  → JSON.stringify [pure]

**QueueManager.drainQueue** (`src/queue/manager.ts`) `@effects fs.read, fs.write, log`
  → listJobsByStatus [fs.read]
  → pendingJobs.filter [pure]
  → moveToDeadLetter [fs.read, fs.write, log]
  → console.log [log]

**RateLimiter.tryConsume** (`src/queue/rate-limiter.ts`) `@effects time.read`
  → this.refill [time.read]
  → this.getBucket [time.read]

**RateLimiter.getRemainingTokens** (`src/queue/rate-limiter.ts`) `@effects time.read`
  → this.refill [time.read]
  → Math.floor [pure]
  → this.getBucket [time.read]

**RateLimiter.resetBucket** (`src/queue/rate-limiter.ts`) `@effects time.read`
  → this.buckets.set [pure]
  → Date.now [time.read]

**scheduleJob** (`src/queue/scheduler.ts`) `@effects fs.read, fs.write, time.read`
  → validateCreateJobInput [pure]
  → validation.errors.join [pure]
  → toJobId [pure]
  → Date.now [time.read]
  → insertJob [fs.read, fs.write]

**rescheduleJob** (`src/queue/scheduler.ts`) `@effects fs.read, fs.write`
  → getJob [fs.read]
  → updateJobStatus [fs.read, fs.write]

**cancelJob** (`src/queue/scheduler.ts`) `@effects fs.read, fs.write`
  → getJob [fs.read]
  → updateJobStatus [fs.read, fs.write]

**getUsageRecord** (`src/storage/billing.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → usageKey [pure]

**upsertUsageRecord** (`src/storage/billing.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**incrementJobCount** (`src/storage/billing.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → usageKey [pure]
  → writeDataFile [fs.write]

**listUsageRecords** (`src/storage/billing.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.usage)
    .filter((r) => (r as UsageRecord).tenantId === (tenantId as string))
    .map [pure]
  → Object.values(data.usage)
    .filter [pure]
  → Object.values [pure]

**openDatabase** (`src/storage/connection.ts`) `@effects fs.read, fs.write`
  → fs.existsSync [fs.read]
  → fs.writeFileSync [fs.write]
  → JSON.stringify [pure]

**readDataFile** (`src/storage/connection.ts`) `@effects fs.read`
  → fs.readFileSync [fs.read]
  → JSON.parse [pure]

**writeDataFile** (`src/storage/connection.ts`) `@effects fs.write`
  → fs.writeFileSync [fs.write]
  → JSON.stringify [pure]

**insertJob** (`src/storage/jobs.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**getJob** (`src/storage/jobs.ts`) `@effects fs.read`
  → readDataFile [fs.read]

**updateJobStatus** (`src/storage/jobs.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**listJobsByTenant** (`src/storage/jobs.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs)
    .filter((j) => (j as Job).tenantId === (tenantId as string))
    .map [pure]
  → Object.values(data.jobs)
    .filter [pure]
  → Object.values [pure]

**listJobsByStatus** (`src/storage/jobs.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs)
    .filter((j) => (j as Job).status === status)
    .map [pure]
  → Object.values(data.jobs)
    .filter [pure]
  → Object.values [pure]
  → matched.slice [pure]

**deleteOldJobs** (`src/storage/jobs.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → Object.entries [pure]
  → writeDataFile [fs.write]

**runMigrations** (`src/storage/migrations.ts`) `@effects fs.read, fs.write, log`
  → console.log [log]
  → readDataFile [fs.read]
  → createInitialSchema [fs.read, fs.write, log]

**createInitialSchema** (`src/storage/migrations.ts`) `@effects fs.read, fs.write, log`
  → readDataFile [fs.read]
  → console.log [log]
  → new Date().toISOString [pure]
  → writeDataFile [fs.write]

**countJobsByTenant** (`src/storage/queries.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs).filter [pure]
  → Object.values [pure]

**countActiveJobs** (`src/storage/queries.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs).filter [pure]
  → Object.values [pure]

**getOldestPendingJob** (`src/storage/queries.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs)
    .map((j) => j as Job)
    .filter((j) => j.status === "pending")
    .filter [pure]
  → Object.values(data.jobs)
    .map((j) => j as Job)
    .filter [pure]
  → Object.values(data.jobs)
    .map [pure]
  → Object.values [pure]
  → pending.sort [pure]
  → new Date(a.createdAt).getTime [pure]
  → new Date(b.createdAt).getTime [pure]

**getJobsByPriorityOrder** (`src/storage/queries.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.jobs)
    .map((j) => j as Job)
    .filter [pure]
  → Object.values(data.jobs)
    .map [pure]
  → Object.values [pure]
  → jobs.sort [pure]
  → new Date(a.createdAt).getTime [pure]
  → new Date(b.createdAt).getTime [pure]
  → jobs.slice [pure]

**insertTenant** (`src/storage/tenants.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**getTenant** (`src/storage/tenants.ts`) `@effects fs.read`
  → readDataFile [fs.read]

**getTenantByApiKey** (`src/storage/tenants.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.tenants).find [pure]
  → Object.values [pure]

**updateTenantStatus** (`src/storage/tenants.ts`) `@effects fs.read, fs.write`
  → readDataFile [fs.read]
  → writeDataFile [fs.write]

**listTenants** (`src/storage/tenants.ts`) `@effects fs.read`
  → readDataFile [fs.read]
  → Object.values(data.tenants).map [pure]
  → Object.values [pure]

**formatJobSummary** (`src/transforms/format.ts`) `@effects time.read`
  → job.id.slice [pure]
  → formatDuration [pure]
  → Date.now [time.read]
  → job.createdAt.getTime [pure]
  → job.queueName.padEnd [pure]
  → String(job.status).padEnd [pure]
  → String [pure]
  → parts.push [pure]
  → parts.join [pure]

**createBaseWorker** (`src/workers/base.ts`) `@effects log`
  → console.log [log]

**logWorkerEvent** (`src/workers/base.ts`) `@effects log`
  → console.log [log]

**createEmailWorker** (`src/workers/email-worker.ts`) `@effects log, time.read`
  → processEmailJob [log, time.read]
  → console.log [log]

**processEmailJob** (`src/workers/email-worker.ts`) `@effects log, time.read`
  → Date.now [time.read]
  → logWorkerEvent [log]
  → smtpLog.push [pure]
  → String [pure]

**checkWorkerHealth** (`src/workers/health.ts`) `@effects time.read, log`
  → Date.now [time.read]
  → console.log [log]

**checkPoolHealth** (`src/workers/health.ts`) `@effects time.read, log`
  → Date.now [time.read]
  → pool.getPoolStats [log]
  → console.log [log]

**createHttpWorker** (`src/workers/http-worker.ts`) `@effects net.https, log, time.read`
  → processHttpJob [net.https, log, time.read]
  → console.log [log]

**processHttpJob** (`src/workers/http-worker.ts`) `@effects net.https, log, time.read`
  → Date.now [time.read]
  → logWorkerEvent [log]
  → fetch [net.https]
  → JSON.stringify [pure]
  → response.text [pure]
  → responseBody.slice [pure]
  → String [pure]

**WorkerPool.addWorker** (`src/workers/pool.ts`) `@effects log`
  → this.workers.set [pure]
  → console.log [log]

**WorkerPool.removeWorker** (`src/workers/pool.ts`) `@effects log`
  → this.workers.delete [pure]
  → console.log [log]

**WorkerPool.assignJob** (`src/workers/pool.ts`) `@effects log, time.sleep`
  → logWorkerEvent [log]
  → setTimeout [time.sleep]
  → worker.processJob [pure]
  → String [pure]

**WorkerPool.getPoolStats** (`src/workers/pool.ts`) `@effects log`
  → this.workers.values [pure]
  → console.log [log]
  → JSON.stringify [pure]

**createTransformWorker** (`src/workers/transform-worker.ts`) `@effects log, time.read`
  → processTransformJob [log, time.read]
  → console.log [log]

**processTransformJob** (`src/workers/transform-worker.ts`) `@effects log, time.read`
  → Date.now [time.read]
  → logWorkerEvent [log]
  → input.toUpperCase [pure]
  → input.toLowerCase [pure]
  → input.split("").reverse().join [pure]
  → input.split("").reverse [pure]
  → input.split [pure]
  → Array.isArray [pure]
  → [...input].reverse [pure]
  → String [pure]

**createWebhookWorker** (`src/workers/webhook-worker.ts`) `@effects net.https, log, time.read`
  → processWebhookJob [net.https, log, time.read]
  → console.log [log]

**processWebhookJob** (`src/workers/webhook-worker.ts`) `@effects net.https, log, time.read`
  → Date.now [time.read]
  → logWorkerEvent [log]
  → new Date().toISOString [pure]
  → fetch [net.https]
  → JSON.stringify [pure]
  → response.text [pure]
  → errorText.slice [pure]
  → String [pure]


## Quick reference

- `@effects` (empty) = **pure function** — no IO allowed
- `@effects net.https, fs.write` = function performs these IO operations (and only these)
- `@idempotent` = safe to retry or cache
<!-- hewg:end -->
